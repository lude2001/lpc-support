"""Verify trusted CI VSIX artifacts; publishing requires an explicit manual run.

Only Python's standard library is used. Preparing or checking a release never
authenticates to Marketplace, runs package code, or invokes the publisher.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import struct
import subprocess
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

REPOSITORY = "lude2001/lpc-support"
PUBLISHER = "ludexiang"
EXTENSION = "lpc-support"
CI_WORKFLOW = ".github/workflows/ci.yml"
PUBLISH_WORKFLOW = ".github/workflows/publish-marketplace.yml"
TARGETS = ("win32-x64", "win32-arm64", "linux-x64", "linux-arm64", "darwin-x64", "darwin-arm64")
MAX_ARCHIVE_BYTES = 128 * 1024 * 1024
MAX_PACKAGE_BYTES = 64 * 1024 * 1024
MAX_EXPANDED_BYTES = 256 * 1024 * 1024


class ReleaseError(Exception):
    pass


def require(condition, message):
    if not condition:
        raise ReleaseError(message)


def version_string(value):
    require(isinstance(value, str) and re.fullmatch(r"(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)", value),
            "Version must be an exact major.minor.patch release version")
    require(all(int(part) <= 2147483647 for part in value.split(".")), "Version component is too large")
    return value


def run_number(value):
    require(re.fullmatch(r"[1-9]\d{0,19}", str(value)), "CI run ID must be a positive integer")
    return int(value)


def sha_string(value):
    require(isinstance(value, str) and re.fullmatch(r"[0-9a-f]{40}", value), "Invalid source commit SHA")
    return value


def sha256(data):
    return hashlib.sha256(data).hexdigest()


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        return None


class GitHub:
    def __init__(self, token=None):
        self.token = token if token is not None else os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
        require(bool(self.token), "Set GH_TOKEN or GITHUB_TOKEN with contents:read and actions:read")

    def request(self, route):
        require(route.startswith(f"/repos/{REPOSITORY}/"), "Unexpected GitHub API route")
        return urllib.request.Request("https://api.github.com" + route, headers={
            "Authorization": f"Bearer {self.token}", "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "lpc-support-release"
        })

    def get(self, route):
        with urllib.request.urlopen(self.request(route), timeout=60) as response:
            return json.load(response)

    def artifact(self, artifact_id):
        # The artifact endpoint redirects to a signed blob URL. Do not forward
        # the GitHub Authorization header to the storage host.
        request = self.request(f"/repos/{REPOSITORY}/actions/artifacts/{run_number(artifact_id)}/zip")
        try:
            response = urllib.request.build_opener(NoRedirect()).open(request, timeout=60)
        except urllib.error.HTTPError as error:
            require(error.code in (301, 302, 303, 307, 308), "GitHub artifact download failed")
            location = error.headers.get("Location", "")
            require(location.startswith("https://"), "Artifact redirect must use HTTPS")
            response = urllib.request.urlopen(urllib.request.Request(location), timeout=120)
        with response:
            data = response.read(MAX_ARCHIVE_BYTES + 1)
        require(len(data) <= MAX_ARCHIVE_BYTES, "Artifact archive is too large")
        return data


def source_artifacts(api, ci_run_id):
    ci_run_id = run_number(ci_run_id)
    run = api.get(f"/repos/{REPOSITORY}/actions/runs/{ci_run_id}")
    workflow = api.get(f"/repos/{REPOSITORY}/actions/workflows/ci.yml")
    require(run.get("id") == ci_run_id, "GitHub returned a different CI run")
    require(run.get("status") == "completed" and run.get("conclusion") == "success", "CI run must be completed and successful")
    require(run.get("head_branch") == "main" and run.get("event") in ("push", "workflow_dispatch"),
            "Release artifacts must come from a main-branch push or manual CI run, not a pull request")
    require(run.get("head_repository", {}).get("full_name") == REPOSITORY, "CI run is from a different repository")
    require(workflow.get("path") == CI_WORKFLOW and run.get("workflow_id") == workflow.get("id"), "CI workflow identity does not match")
    head_sha = sha_string(run.get("head_sha"))
    artifacts = []
    for page in range(1, 101):
        batch = api.get(f"/repos/{REPOSITORY}/actions/runs/{ci_run_id}/artifacts?per_page=100&page={page}").get("artifacts", [])
        artifacts.extend(batch)
        if len(batch) < 100:
            break
    else:
        raise ReleaseError("Too many artifacts in this CI run")
    selected = {}
    for target in TARGETS:
        matches = [artifact for artifact in artifacts if artifact.get("name") == f"lpc-support-{target}"]
        require(len(matches) == 1, f"Expected exactly one CI artifact for {target}")
        artifact = matches[0]
        require(not artifact.get("expired", True), f"CI artifact expired: {target}")
        require(artifact.get("workflow_run", {}).get("head_sha") == head_sha, f"Artifact source commit differs: {target}")
        require(isinstance(artifact.get("size_in_bytes"), int) and 0 < artifact["size_in_bytes"] <= MAX_ARCHIVE_BYTES,
                f"Invalid artifact size: {target}")
        require(re.fullmatch(r"sha256:[0-9a-f]{64}", artifact.get("digest", "")), f"Artifact digest is missing: {target}")
        selected[target] = artifact
    return run, selected


def checked_zip(data):
    require(len(data) <= MAX_ARCHIVE_BYTES, "ZIP archive is too large")
    archive = zipfile.ZipFile(io.BytesIO(data))
    seen = set()
    expanded = 0
    for info in archive.infolist():
        name = info.orig_filename
        path = PurePosixPath(name)
        require(name and name == info.filename and "\0" not in name and "\\" not in name and not path.is_absolute() and ".." not in path.parts and ":" not in name,
                "Unsafe ZIP entry name")
        require(name.casefold() not in seen, "Duplicate ZIP entry")
        seen.add(name.casefold())
        require(not info.flag_bits & 1, "Encrypted ZIP entries are not supported")
        require(not stat.S_ISLNK(info.external_attr >> 16), "ZIP symlinks are not supported")
        expanded += info.file_size
        require(expanded <= MAX_EXPANDED_BYTES, "Expanded ZIP archive is too large")
    return archive


def member(archive, name):
    try:
        info = archive.getinfo(name)
    except KeyError:
        raise ReleaseError(f"VSIX is missing {name}") from None
    require(info.file_size <= MAX_PACKAGE_BYTES, f"VSIX member is too large: {name}")
    return archive.read(info)


def binary_architecture(data, target):
    require(len(data) >= 64, f"Invalid native sidecar: {target}")
    architecture = target.split("-")[1]
    if target.startswith("win32-"):
        require(data[:2] == b"MZ", "Windows sidecar is not PE")
        offset = struct.unpack_from("<I", data, 60)[0]
        require(offset + 6 <= len(data) and data[offset:offset + 4] == b"PE\0\0", "Invalid PE header")
        machine = struct.unpack_from("<H", data, offset + 4)[0]
        require(machine == {"x64": 0x8664, "arm64": 0xAA64}[architecture], f"PE architecture differs: {target}")
    elif target.startswith("linux-"):
        require(data[:4] == b"\x7fELF" and data[4] == 2 and data[5] == 1, "Linux sidecar must be a little-endian ELF64 binary")
        machine = struct.unpack_from("<H", data, 18)[0]
        require(machine == {"x64": 62, "arm64": 183}[architecture], f"ELF architecture differs: {target}")
    else:
        require(data[:4] == b"\xcf\xfa\xed\xfe", "macOS sidecar must be a native little-endian Mach-O64 binary")
        machine = struct.unpack_from("<I", data, 4)[0]
        require(machine == {"x64": 0x01000007, "arm64": 0x0100000C}[architecture], f"Mach-O architecture differs: {target}")


def inspect_vsix(data, target, version):
    require(target in TARGETS and len(data) <= MAX_PACKAGE_BYTES, "Unsupported or oversized VSIX")
    with checked_zip(data) as archive:
        manifest = json.loads(member(archive, "extension/package.json"))
        identity = ET.fromstring(member(archive, "extension.vsixmanifest")).find("{*}Metadata/{*}Identity")
        require(identity is not None, "VSIX identity is missing")
        for key, value in (("Publisher", PUBLISHER), ("Id", EXTENSION), ("Version", version), ("TargetPlatform", target)):
            require(identity.get(key) == value, f"VSIX {key} differs: {target}")
        require(manifest.get("publisher") == PUBLISHER and manifest.get("name") == EXTENSION and manifest.get("version") == version,
                f"VSIX package.json identity differs: {target}")
        properties = ET.fromstring(member(archive, "extension.vsixmanifest")).findall("{*}Metadata/{*}Properties/{*}Property")
        require(not any(prop.get("Id") == "Microsoft.VisualStudio.Code.PreRelease" and prop.get("Value", "").lower() == "true" for prop in properties),
                "This workflow publishes stable releases only")
        binary_name = "lpc-language-server.exe" if target.startswith("win32-") else "lpc-language-server"
        binary_path = f"extension/dist/bin/{binary_name}"
        binaries = {info.filename for info in archive.infolist() if info.filename.startswith("extension/dist/bin/") and not info.is_dir()}
        require(binaries == {binary_path, binary_path + ".sha256"}, f"Unexpected native binaries: {target}")
        data_binary = member(archive, binary_path)
        binary_architecture(data_binary, target)
        digest = sha256(data_binary)
        checksum = member(archive, binary_path + ".sha256").decode("utf-8").split()
        require(checksum == [digest, binary_name], f"Sidecar checksum differs: {target}")
        if not target.startswith("win32-"):
            require(archive.getinfo(binary_path).external_attr >> 16 & 0o111, f"Sidecar is not executable: {target}")
        return digest


def package_filename(target, version):
    return f"lpc-support-{target}-{version}.vsix"


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def summary(plan, results=None):
    lines = ["## VS Code Marketplace release", "", f"Version: `{plan['version']}` | CI: `{plan['ciRunId']}` | Source: `{plan['headSha']}`", "",
             "| Platform | Package SHA-256 | Result |", "| --- | --- | --- |"]
    for entry in plan["packages"]:
        status = results.get(entry["target"], "verified; not published") if results else "verified; not published"
        lines.append(f"| {entry['target']} | `{entry['sha256']}` | {status} |")
    text = "\n".join(lines) + "\n"
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as stream:
            stream.write(text)
    print(text)


def prepare_release(api, ci_run_id, version, directory):
    version = version_string(version)
    ci_run_id = run_number(ci_run_id)
    require(not directory.exists(), "Use a new output directory for release preparation")
    run, artifacts = source_artifacts(api, ci_run_id)
    plan = {"schemaVersion": 1, "repository": REPOSITORY, "workflowPath": CI_WORKFLOW, "ciRunId": ci_run_id,
            "ciRunAttempt": run["run_attempt"], "headSha": run["head_sha"], "version": version,
            "publisher": PUBLISHER, "extensionName": EXTENSION, "packages": []}
    packages = []
    for target, artifact in artifacts.items():
        print(f"Checking {target}...")
        archive_data = api.artifact(artifact["id"])
        require("sha256:" + sha256(archive_data) == artifact["digest"], f"Downloaded artifact digest differs: {target}")
        filename = package_filename(target, version)
        with checked_zip(archive_data) as archive:
            files = [info.filename for info in archive.infolist() if not info.is_dir()]
            require(files == [filename], f"Artifact must contain exactly {filename}")
            vsix = member(archive, filename)
        binary_digest = inspect_vsix(vsix, target, version)
        plan["packages"].append({"target": target, "filename": filename, "bytes": len(vsix), "sha256": sha256(vsix),
                                 "sidecarSha256": binary_digest, "artifactId": artifact["id"], "artifactDigest": artifact["digest"]})
        packages.append((filename, vsix))
    directory.mkdir(parents=True)
    for filename, data in packages:
        (directory / filename).write_bytes(data)
    write_json(directory / "release-plan.json", plan)
    summary(plan)
    return plan


def verify_release(directory, version, ci_run_id, head_sha, plan_sha256):
    version = version_string(version)
    ci_run_id = run_number(ci_run_id)
    head_sha = sha_string(head_sha)
    plan_path = directory / "release-plan.json"
    require(plan_path.is_file() and not plan_path.is_symlink() and plan_path.stat().st_size < 1024 * 1024, "Invalid release plan")
    require(isinstance(plan_sha256, str) and re.fullmatch(r"[0-9a-f]{64}", plan_sha256), "Expected release-plan SHA-256 is required")
    plan_bytes = plan_path.read_bytes()
    require(sha256(plan_bytes) == plan_sha256, "Release plan hash differs from the preflight job output")
    plan = json.loads(plan_bytes)
    expected = {"schemaVersion": 1, "repository": REPOSITORY, "workflowPath": CI_WORKFLOW, "ciRunId": ci_run_id,
                "headSha": head_sha, "version": version, "publisher": PUBLISHER, "extensionName": EXTENSION}
    require(all(plan.get(key) == value for key, value in expected.items()), "Release plan source or identity differs")
    entries = plan.get("packages", [])
    require(len(entries) == len(TARGETS) and {entry.get("target") for entry in entries} == set(TARGETS), "Release must contain each of the six platforms exactly once")
    require({path.name for path in directory.glob("*.vsix")} == {package_filename(target, version) for target in TARGETS}, "Unexpected VSIX file set")
    for entry in entries:
        filename = package_filename(entry["target"], version)
        require(entry.get("filename") == filename, "Release plan filename differs")
        file = directory / filename
        require(file.is_file() and not file.is_symlink() and file.stat().st_size <= MAX_PACKAGE_BYTES, "Invalid package file")
        data = file.read_bytes()
        require(len(data) == entry.get("bytes") and sha256(data) == entry.get("sha256"), f"Package hash differs: {entry['target']}")
        require(inspect_vsix(data, entry["target"], version) == entry.get("sidecarSha256"), "Sidecar hash differs from release plan")
    return plan


def assert_manual_origin(environment):
    require(environment.get("GITHUB_ACTIONS") == "true" and environment.get("GITHUB_EVENT_NAME") == "workflow_dispatch",
            "Publishing is only allowed from a manually dispatched GitHub Actions run")
    require(environment.get("GITHUB_REPOSITORY") == REPOSITORY and environment.get("GITHUB_REF") == "refs/heads/main",
            "Publishing must run on this repository's main branch")
    require(environment.get("GITHUB_WORKFLOW_REF") == f"{REPOSITORY}/{PUBLISH_WORKFLOW}@refs/heads/main", "Unexpected publishing workflow")


def assert_manual_publish(environment, version, ci_run_id):
    assert_manual_origin(environment)
    event = json.loads(Path(environment.get("GITHUB_EVENT_PATH", "")).read_text(encoding="utf-8"))
    inputs = event.get("inputs", {})
    require(inputs.get("operation") == "publish", "The manual operation must be 'publish'")
    require(inputs.get("version") == version and str(inputs.get("ci_run_id")) == str(ci_run_id), "Manual inputs differ from release plan")
    return inputs.get("resume") in (True, "true")


def publisher_command():
    vsce = Path(__file__).resolve().parents[1] / "node_modules/@vscode/vsce/vsce"
    require(vsce.is_file(), "Install the locked publisher tooling with npm ci --ignore-scripts")
    return ["node", str(vsce)]


def publish_release(directory, version, ci_run_id, head_sha, *, plan_sha256, execute=False, api=None, runner=subprocess.run, environment=None):
    plan = verify_release(directory, version, ci_run_id, head_sha, plan_sha256)
    if not execute:
        summary(plan)
        print("Dry run: no Marketplace authentication or publishing was attempted.")
        return plan
    environment = environment if environment is not None else os.environ
    resume = assert_manual_publish(environment, version, ci_run_id)
    require(api is not None, "Publishing must recheck the source CI run")
    run, artifacts = source_artifacts(api, ci_run_id)
    require(run["head_sha"] == head_sha and run["run_attempt"] == plan["ciRunAttempt"], "CI run changed since preflight")
    for entry in plan["packages"]:
        artifact = artifacts[entry["target"]]
        require(artifact["id"] == entry["artifactId"] and artifact["digest"] == entry["artifactDigest"], "CI artifact changed since preflight")
    publisher = publisher_command()
    results = {target: "not attempted" for target in TARGETS}
    failed = False
    try:
        for entry in plan["packages"]:
            command = publisher + ["publish", "--packagePath", str((directory / entry["filename"]).resolve()), "--azure-credential"]
            if resume:
                command.append("--skip-duplicate")
            print(f"Publishing {entry['target']}...", flush=True)
            outcome = runner(command, check=False)
            if outcome.returncode:
                results[entry["target"]] = "failed"
                failed = True
                break
            results[entry["target"]] = "completed (published or already present)" if resume else "published"
    finally:
        write_json(directory / "publish-results.json", {"version": version, "ciRunId": ci_run_id, "headSha": head_sha,
                                                       "resume": resume, "results": results})
        summary(plan, results)
    require(not failed, "Publishing stopped after a failure; inspect the platform results before manually resuming the same CI release")
    return plan


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("prepare", "verify", "publish"))
    parser.add_argument("--run-id", required=True, type=run_number)
    parser.add_argument("--version", required=True, type=version_string)
    parser.add_argument("--directory", required=True, type=Path)
    parser.add_argument("--sha")
    parser.add_argument("--plan-sha256")
    parser.add_argument("--execute", action="store_true", help="Explicitly publish; otherwise only verify local files")
    args = parser.parse_args()
    require(not args.execute or args.command == "publish", "--execute is only valid for publishing")
    if args.command == "prepare":
        if os.environ.get("GITHUB_ACTIONS") == "true":
            assert_manual_origin(os.environ)
        plan = prepare_release(GitHub(), args.run_id, args.version, args.directory)
        if os.environ.get("GITHUB_OUTPUT"):
            with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as stream:
                stream.write(f"head_sha={plan['headSha']}\nversion={plan['version']}\n")
                stream.write(f"plan_sha256={sha256((args.directory / 'release-plan.json').read_bytes())}\n")
    else:
        require(bool(args.sha), "--sha is required to verify or publish a prepared release")
        require(bool(args.plan_sha256), "--plan-sha256 from the preflight job is required")
        if args.command == "verify":
            summary(verify_release(args.directory, args.version, args.run_id, args.sha, args.plan_sha256))
        else:
            publish_release(args.directory, args.version, args.run_id, args.sha, execute=args.execute,
                            plan_sha256=args.plan_sha256, api=GitHub() if args.execute else None)


if __name__ == "__main__":
    try:
        main()
    except (ReleaseError, OSError, ValueError, KeyError, zipfile.BadZipFile, ET.ParseError) as error:
        # Avoid printing signed download URLs, authentication headers or API bodies.
        print(f"Release failed: {error if isinstance(error, ReleaseError) else type(error).__name__}", file=sys.stderr)
        sys.exit(1)
