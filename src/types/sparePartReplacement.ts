export interface SparePartLocation {
  workshopId: string
  lineId: string
  ipcId: string
  locationId: string
  locationName: string
  expectedSparePartType: string | null
  physicalLocation: string | null
  enabled: boolean
  remark: string | null
  createdTime: string
  updatedTime: string
}

export interface SparePartLocationListResponse {
  count: number
  items: SparePartLocation[]
}

export interface SaveSparePartLocationParams {
  locationId: string
  locationName: string
  expectedSparePartType?: string
  physicalLocation?: string
  enabled: boolean
  remark?: string
}

export interface SparePartUsageStatus {
  workshopId: string
  lineId: string
  ipcId: string
  locationId: string
  locationName: string
  expectedSparePartType: string | null
  physicalLocation: string | null
  enabled: boolean
  sparePartName: string | null
  sparePartType: string | null
  replacementTime: string | null
  replacedBy: string | null
  partNo: string | null
  serialNo: string | null
  locationRemark: string | null
  replacementRemark: string | null
  recordCreatedTime: string | null
  installedDays: number | null
  installedHours: number | null
  hasReplacementRecord: boolean
}

export interface SparePartReplacementStatusResponse {
  count: number
  items: SparePartUsageStatus[]
}

export interface SparePartReplacementRecord {
  id: number
  workshopId: string
  lineId: string
  ipcId: string
  locationId: string
  sparePartName: string
  sparePartType: string | null
  physicalLocation: string | null
  replacementTime: string
  replacedBy: string
  partNo: string | null
  serialNo: string | null
  remark: string | null
  createdTime: string
}

export interface RecordSparePartReplacementParams {
  locationId: string
  sparePartName?: string
  sparePartType?: string
  replacementTime?: string
  replacedBy?: string
  partNo?: string
  serialNo?: string
  remark?: string
}

export interface RecordSparePartReplacementResponse {
  message: string
  record: SparePartReplacementRecord
  status: SparePartUsageStatus
}

export interface SparePartReplacementHistoryResponse {
  count: number
  locationId: string | null
  items: SparePartReplacementRecord[]
}
