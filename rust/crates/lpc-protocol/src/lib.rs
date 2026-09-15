use serde::Serialize;

pub const HEALTH_METHOD: &str = "lpc/health";

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HealthStatusResponse {
    pub status: &'static str,
    pub mode: &'static str,
    pub server_version: &'static str,
    pub document_count: usize,
    pub performance: PerformanceStatus,
}

#[derive(Debug, Clone, Default, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PerformanceStatus {
    pub documents: DocumentPerformanceStatus,
    pub syntax: SyntaxPerformanceStatus,
    pub process_memory: ProcessMemoryStatus,
    pub analysis_snapshot_build_count: u64,
    pub analysis_query_count: u64,
    pub analysis_total_build_time_micros: u64,
    pub indexed_file_count: u64,
}

#[derive(Debug, Clone, Default, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProcessMemoryStatus {
    pub resident_bytes: u64,
    pub peak_resident_bytes: u64,
}

#[derive(Debug, Clone, Default, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DocumentPerformanceStatus {
    pub open_count: u64,
    pub close_count: u64,
    pub full_replacement_count: u64,
    pub incremental_edit_count: u64,
    pub rejected_change_count: u64,
}

#[derive(Debug, Clone, Default, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SyntaxPerformanceStatus {
    pub parse_count: u64,
    pub full_parse_count: u64,
    pub incremental_parse_count: u64,
    pub total_parse_time_micros: u64,
}
