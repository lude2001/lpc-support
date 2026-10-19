import copy
import io
import json
from pathlib import Path
import stat
import struct
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import marketplace_release as release

VERSION = "0.52.19"
RUN = 123456
SHA = "a" * 40


def native_binary(target):
    data = bytearray(128)
    architecture = target.split("-")[1]
    if target.startswith("win32-"):
        data[:2] = b"MZ"
        struct.pack_into("<I", data, 60, 64)
        data[64:68] = b"PE\0\0"
        struct.pack_into("<H", data, 68, {"x64": 0x8664, "arm64": 0xAA64}[architecture])
    elif target.startswith("linux-"):
        data[:6] = b"\x7fELF\x02\x01"
        struct.pack_into("<H", data, 18, {"x64": 62, "arm64": 183}[architecture])
    else:
        data[:4] = b"\xcf\xfa\xed\xfe"
        struct.pack_into("<I", data, 4, {"x64": 0x01000007, "arm64": 0x0100000C}[architecture])
    return bytes(data)


def zip_bytes(entries):
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, data, mode in entries:
            info = zipfile.ZipInfo(name)
            info.external_attr = (stat.S_IFREG | mode) << 16
            archive.writestr(info, data)
    return output.getvalue()


def vsix(target, version=VERSION, *, publisher=release.PUBLISHER, binary_target=None, checksum=None, mode=0o755):
    binary_name = "lpc-language-server.exe" if target.startswith("win32-") else "lpc-language-server"
    data_binary = native_binary(binary_target or target)
    digest = checksum or release.sha256(data_binary)
    identity = f'<Identity Id="lpc-support" Publisher="{publisher}" Version="{version}" TargetPlatform="{target}"/>'
    xml = f'<PackageManifest xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011"><Metadata>{identity}<Properties/></Metadata></PackageManifest>'
    return zip_bytes([
        ("extension.vsixmanifest", xml, 0o644),
        ("extension/package.json", json.dumps({"publisher": publisher, "name": "lpc-support", "version": version}), 0o644),
        (f"extension/dist/bin/{binary_name}", data_binary, mode),
        (f"extension/dist/bin/{binary_name}.sha256", f"{digest}  {binary_name}\n", 0o644),
    ])


class FakeGitHub:
    def __init__(self):
        self.run = {"id": RUN, "status": "completed", "conclusion": "success", "event": "push", "head_branch": "main",
                    "head_repository": {"full_name": release.REPOSITORY}, "workflow_id": 42, "head_sha": SHA, "run_attempt": 1}
        self.workflow = {"id": 42, "path": release.CI_WORKFLOW}
        self.artifacts = []
        self.downloads = {}
        self.download_count = 0
        for index, target in enumerate(release.TARGETS, 1):
            data = zip_bytes([(release.package_filename(target, VERSION), vsix(target), 0o644)])
            self.downloads[index] = data
            self.artifacts.append({"id": index, "name": f"lpc-support-{target}", "expired": False, "size_in_bytes": len(data),
                                   "digest": "sha256:" + release.sha256(data), "workflow_run": {"head_sha": SHA}})

    def get(self, route):
        if route.endswith("/actions/workflows/ci.yml"):
            return copy.deepcopy(self.workflow)
        if "/artifacts?" in route:
            return {"artifacts": copy.deepcopy(self.artifacts)}
        if route.endswith(f"/actions/runs/{RUN}"):
            return copy.deepcopy(self.run)
        raise AssertionError(f"Unexpected route {route}")

    def artifact(self, artifact_id):
        self.download_count += 1
        return self.downloads[artifact_id]


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="lpc-release-tests-")
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name) / "release"
        self.api = FakeGitHub()
        self.stdout = patch("sys.stdout", new=io.StringIO())
        self.stdout.start()
        self.addCleanup(self.stdout.stop)
        self.environment = {"GITHUB_ACTIONS": "true", "GITHUB_EVENT_NAME": "workflow_dispatch", "GITHUB_REPOSITORY": release.REPOSITORY,
                            "GITHUB_REF": "refs/heads/main", "GITHUB_WORKFLOW_REF": f"{release.REPOSITORY}/{release.PUBLISH_WORKFLOW}@refs/heads/main"}
        event = Path(self.temporary.name) / "event.json"
        event.write_text(json.dumps({"inputs": {"ci_run_id": str(RUN), "version": VERSION, "operation": "publish", "resume": "false"}}), encoding="utf-8")
        self.environment["GITHUB_EVENT_PATH"] = str(event)

    def prepare(self):
        plan = release.prepare_release(self.api, RUN, VERSION, self.directory)
        self.plan_hash = release.sha256((self.directory / "release-plan.json").read_bytes())
        return plan

    def publish(self, **kwargs):
        return release.publish_release(self.directory, VERSION, RUN, SHA, plan_sha256=self.plan_hash, **kwargs)

    def test_prepares_and_rechecks_six_platforms_and_source_identity(self):
        plan = self.prepare()
        self.assertEqual(len(plan["packages"]), 6)
        self.assertEqual(self.api.download_count, 6)
        self.assertEqual(release.verify_release(self.directory, VERSION, RUN, SHA, self.plan_hash), plan)

    def test_rejects_failed_incomplete_pr_and_foreign_ci_runs_before_download(self):
        for update in ({"conclusion": "failure"}, {"status": "in_progress"}, {"event": "pull_request"},
                       {"head_branch": "feature"}, {"workflow_id": 999}, {"head_repository": {"full_name": "someone/fork"}}):
            with self.subTest(update=update):
                api = FakeGitHub()
                api.run.update(update)
                with self.assertRaises(release.ReleaseError):
                    release.prepare_release(api, RUN, VERSION, self.directory)
                self.assertEqual(api.download_count, 0)
                self.assertFalse(self.directory.exists())

    def test_rejects_missing_duplicate_expired_unbound_and_different_source_artifacts(self):
        for mutation in (lambda api: api.artifacts.pop(), lambda api: api.artifacts.append(api.artifacts[0]),
                         lambda api: api.artifacts[0].update(expired=True), lambda api: api.artifacts[0].update(digest=""),
                         lambda api: api.artifacts[0].update(workflow_run={"head_sha": "b" * 40})):
            api = FakeGitHub()
            mutation(api)
            with self.assertRaises(release.ReleaseError):
                release.prepare_release(api, RUN, VERSION, self.directory)
            self.assertEqual(api.download_count, 0)

    def test_rejects_download_digest_changes(self):
        self.api.downloads[1] += b"changed"
        with self.assertRaisesRegex(release.ReleaseError, "digest differs"):
            self.prepare()
        self.assertFalse(self.directory.exists())

    def test_rejects_wrong_version_publisher_platform_binary_and_checksum(self):
        cases = [(vsix("win32-x64", "0.52.18"), "win32-x64"),
                 (vsix("win32-x64", publisher="someone"), "win32-x64"),
                 (vsix("win32-arm64"), "win32-x64"),
                 (vsix("win32-x64", binary_target="win32-arm64"), "win32-x64"),
                 (vsix("linux-x64", binary_target="linux-arm64"), "linux-x64"),
                 (vsix("darwin-x64", binary_target="darwin-arm64"), "darwin-x64"),
                 (vsix("win32-x64", checksum="0" * 64), "win32-x64"),
                 (vsix("linux-x64", mode=0o644), "linux-x64")]
        for data, target in cases:
            with self.assertRaises(release.ReleaseError):
                release.inspect_vsix(data, target, VERSION)

    def test_zip_entry_traversal_aliasing_and_symlinks_are_rejected(self):
        for entries in ([('../outside', b"x", 0o644)],
                        [('same', b"x", 0o644), ('SAME', b"x", 0o644)]):
            with self.assertRaises(release.ReleaseError):
                release.checked_zip(zip_bytes(entries))
        # ZipInfo normalizes Windows separators when creating a fixture; alter
        # both directory records to represent the actual malformed input.
        backslash_zip = zip_bytes([('a/b', b"x", 0o644)]).replace(b'a/b', b'a\\b')
        with self.assertRaises(release.ReleaseError):
            release.checked_zip(backslash_zip)
        output = io.BytesIO()
        with zipfile.ZipFile(output, "w") as archive:
            info = zipfile.ZipInfo("link")
            info.external_attr = (stat.S_IFLNK | 0o777) << 16
            archive.writestr(info, "outside")
        with self.assertRaises(release.ReleaseError):
            release.checked_zip(output.getvalue())

    def test_existing_output_is_not_overwritten(self):
        self.prepare()
        marker = self.directory / "keep"
        marker.write_text("keep", encoding="utf-8")
        with self.assertRaises(release.ReleaseError):
            self.prepare()
        self.assertEqual(marker.read_text(encoding="utf-8"), "keep")

    def test_tampered_local_package_and_plan_source_are_rejected(self):
        plan = self.prepare()
        with self.assertRaises(release.ReleaseError):
            release.verify_release(self.directory, VERSION, RUN, "b" * 40, self.plan_hash)
        (self.directory / plan["packages"][0]["filename"]).write_bytes(b"tampered")
        with self.assertRaises(release.ReleaseError):
            release.verify_release(self.directory, VERSION, RUN, SHA, self.plan_hash)

    def test_dry_run_never_calls_network_or_publisher(self):
        self.prepare()
        runner = Mock(side_effect=AssertionError("publisher must not run"))
        api = Mock(side_effect=AssertionError("network must not run"))
        self.publish(runner=runner, api=api)
        runner.assert_not_called()
        self.assertEqual(api.mock_calls, [])
        self.assertFalse((self.directory / "publish-results.json").exists())

    def test_actual_publish_requires_manual_main_branch_context(self):
        self.prepare()
        for update in ({"GITHUB_ACTIONS": "false"}, {"GITHUB_EVENT_NAME": "push"}, {"GITHUB_REF": "refs/heads/feature"},
                       {"GITHUB_REPOSITORY": "someone/fork"}, {"GITHUB_WORKFLOW_REF": "other"}):
            runner = Mock()
            with self.assertRaises(release.ReleaseError):
                self.publish(execute=True, api=self.api, runner=runner, environment={**self.environment, **update})
            runner.assert_not_called()

    def test_manual_confirmation_and_source_must_match(self):
        self.prepare()
        event = Path(self.environment["GITHUB_EVENT_PATH"])
        for inputs in ({"operation": "verify"}, {"operation": "identity"}, {"operation": "publish", "version": "0.52.18", "ci_run_id": str(RUN)}):
            event.write_text(json.dumps({"inputs": inputs}), encoding="utf-8")
            runner = Mock()
            with self.assertRaises(release.ReleaseError):
                self.publish(execute=True, api=self.api, runner=runner, environment=self.environment)
            runner.assert_not_called()

    @patch("marketplace_release.publisher_command", return_value=["node", "test-publisher"])
    def test_partial_failure_stops_and_records_remaining_platforms(self, unused):
        self.prepare()
        runner = Mock(side_effect=[subprocess_result(0), subprocess_result(1)])
        with self.assertRaisesRegex(release.ReleaseError, "stopped"):
            self.publish(execute=True, api=self.api, runner=runner, environment=self.environment)
        results = json.loads((self.directory / "publish-results.json").read_text(encoding="utf-8"))["results"]
        self.assertEqual(list(results.values()), ["published", "failed", "not attempted", "not attempted", "not attempted", "not attempted"])
        self.assertEqual(runner.call_count, 2)
        self.assertNotIn("--skip-duplicate", runner.call_args_list[0].args[0])

    @patch("marketplace_release.publisher_command", return_value=["node", "test-publisher"])
    def test_resume_is_explicit_and_uses_existing_verified_packages(self, unused):
        self.prepare()
        event = Path(self.environment["GITHUB_EVENT_PATH"])
        event.write_text(json.dumps({"inputs": {"ci_run_id": str(RUN), "version": VERSION, "operation": "publish", "resume": "true"}}), encoding="utf-8")
        runner = Mock(return_value=subprocess_result(0))
        self.publish(execute=True, api=self.api, runner=runner, environment=self.environment)
        self.assertEqual(runner.call_count, 6)
        self.assertTrue(all("--skip-duplicate" in call.args[0] and "--azure-credential" in call.args[0] for call in runner.call_args_list))
        self.assertEqual(self.api.download_count, 6)  # Publishing rechecks metadata, never rebuilds or downloads replacement bytes.

    def test_publish_rechecks_ci_attempt_and_artifact_identity_before_any_upload(self):
        self.prepare()
        for mutation in (lambda: self.api.run.update(run_attempt=2), lambda: self.api.artifacts[0].update(id=999)):
            self.api = FakeGitHub()
            mutation()
            runner = Mock()
            with self.assertRaises(release.ReleaseError):
                self.publish(execute=True, api=self.api, runner=runner, environment=self.environment)
            runner.assert_not_called()

    def test_replaced_release_plan_cannot_redefine_package_hashes(self):
        plan = self.prepare()
        plan["packages"][0]["artifactId"] = 999
        release.write_json(self.directory / "release-plan.json", plan)
        with self.assertRaisesRegex(release.ReleaseError, "plan hash differs"):
            release.verify_release(self.directory, VERSION, RUN, SHA, self.plan_hash)


def subprocess_result(code):
    class Result:
        returncode = code
    return Result()


if __name__ == "__main__":
    unittest.main()
