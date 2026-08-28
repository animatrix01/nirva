from pydantic import BaseModel, Field


class CitationRef(BaseModel):
    title: str
    revision: str
    location: str
    chunk_id: str


class SearchInput(BaseModel):
    query: str
    top_k: int = Field(default=5, ge=1, le=50)
    equipment_id: str | None = None
    department: str | None = None


class SearchResult(BaseModel):
    excerpt: str
    citation: CitationRef
    score: float


class SearchOutput(BaseModel):
    results: list[SearchResult]


class AssetHistoryInput(BaseModel):
    equipment_id: str
    from_ts: str | None = None
    to_ts: str | None = None
    event_types: list[str] | None = None


class AssetEvent(BaseModel):
    event_type: str
    description: str
    source_timestamp: str


class AssetHistoryOutput(BaseModel):
    events: list[AssetEvent]


class InventoryInput(BaseModel):
    part_number: str
    location: str | None = None


class InventoryOutput(BaseModel):
    part_number: str
    available_qty: int
    last_updated: str


class WorkOrderProposalInput(BaseModel):
    asset: str
    justification: str
    parts: list[str]
    steps: list[str]
    cited_evidence: list[CitationRef]
    idempotency_key: str


class WorkOrderProposalOutput(BaseModel):
    proposal_id: str


class WorkOrderApprovalInput(BaseModel):
    proposal_id: str
    approval_token: str
    idempotency_key: str


class WorkOrderApprovalOutput(BaseModel):
    work_order_id: str
