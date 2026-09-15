fn main() {
    let source_directory = std::path::Path::new("src");
    let parser_path = source_directory.join("parser.c");
    let mut build = cc::Build::new();
    build
        .std("c11")
        .include(source_directory)
        .file(&parser_path);

    #[cfg(target_env = "msvc")]
    build.flag("-utf-8");

    println!("cargo:rerun-if-changed={}", parser_path.display());
    build.compile("tree-sitter-lpc-support");
}
