import request from '@/utils/request'
import type {
  RecordSparePartReplacementParams,
  RecordSparePartReplacementResponse,
  SaveSparePartLocationParams,
  SparePartLocation,
  SparePartLocationListResponse,
  SparePartReplacementHistoryResponse,
  SparePartReplacementRecord,
  SparePartReplacementStatusResponse,
  SparePartUsageStatus
} from '@/types/sparePartReplacement'

interface RawSparePart {
  workshopId: string
  lineId: string
  ipcId: string
  sparePartId: string
  sparePartName: string
  sparePartType: string | null
  location: string | null
  enabled: boolean
  remark: string | null
  createdTime: string
  updatedTime: string
}

interface RawUsageStatus extends RawSparePart {
  replacementTime: string | null
  replacedBy: string | null
  partNo: string | null
  serialNo: string | null
  recordCreatedTime: string | null
  installedDays: number | null
  installedHours: number | null
  hasReplacementRecord: boolean
}

interface RawReplacementRecord {
  id: number
  workshopId: string
  lineId: string
  ipcId: string
  sparePartId: string
  sparePartName: string
  sparePartType: string | null
  location: string | null
  replacementTime: string
  replacedBy: string
  partNo: string | null
  serialNo: string | null
  remark: string | null
  createdTime: string
}

const mapLocation = (item: RawSparePart): SparePartLocation => ({
  workshopId: item.workshopId,
  lineId: item.lineId,
  ipcId: item.ipcId,
  locationId: item.sparePartId,
  locationName: item.sparePartName,
  expectedSparePartType: item.sparePartType,
  physicalLocation: item.location,
  enabled: item.enabled,
  remark: item.remark,
  createdTime: item.createdTime,
  updatedTime: item.updatedTime
})

const mapStatus = (item: RawUsageStatus): SparePartUsageStatus => ({
  workshopId: item.workshopId,
  lineId: item.lineId,
  ipcId: item.ipcId,
  locationId: item.sparePartId,
  locationName: item.sparePartName,
  expectedSparePartType: item.sparePartType,
  physicalLocation: item.location,
  enabled: item.enabled,
  sparePartName: item.hasReplacementRecord ? item.sparePartName : null,
  sparePartType: item.hasReplacementRecord ? item.sparePartType : null,
  replacementTime: item.replacementTime,
  replacedBy: item.replacedBy,
  partNo: item.partNo,
  serialNo: item.serialNo,
  locationRemark: item.remark,
  replacementRemark: item.hasReplacementRecord ? item.remark : null,
  recordCreatedTime: item.recordCreatedTime,
  installedDays: item.installedDays,
  installedHours: item.installedHours,
  hasReplacementRecord: item.hasReplacementRecord
})

const mapRecord = (item: RawReplacementRecord): SparePartReplacementRecord => ({
  id: item.id,
  workshopId: item.workshopId,
  lineId: item.lineId,
  ipcId: item.ipcId,
  locationId: item.sparePartId,
  sparePartName: item.sparePartName,
  sparePartType: item.sparePartType,
  physicalLocation: item.location,
  replacementTime: item.replacementTime,
  replacedBy: item.replacedBy,
  partNo: item.partNo,
  serialNo: item.serialNo,
  remark: item.remark,
  createdTime: item.createdTime
})

const toRawLocation = (params: SaveSparePartLocationParams) => ({
  sparePartId: params.locationId,
  sparePartName: params.locationName,
  sparePartType: params.expectedSparePartType,
  location: params.physicalLocation,
  enabled: params.enabled,
  remark: params.remark
})

export const sparePartLocationApi = {
  async getAll(includeDisabled = true): Promise<SparePartLocationListResponse> {
    const response = await request<unknown, { count: number; items: RawSparePart[] }>({
      url: '/api/spare-parts', method: 'GET', params: { includeDisabled }
    })
    return { count: response.count, items: (response.items || []).map(mapLocation) }
  },

  async create(params: SaveSparePartLocationParams): Promise<{ message: string; item: SparePartLocation }> {
    const response = await request<unknown, { message: string; item: RawSparePart }>({
      url: '/api/spare-parts', method: 'POST', data: toRawLocation(params)
    })
    return { message: response.message, item: mapLocation(response.item) }
  },

  async update(locationId: string, params: Omit<SaveSparePartLocationParams, 'locationId'>): Promise<{ message: string; item: SparePartLocation }> {
    const rawParams = toRawLocation({ ...params, locationId })
    const { sparePartId: _, ...data } = rawParams
    const response = await request<unknown, { message: string; item: RawSparePart }>({
      url: `/api/spare-parts/${encodeURIComponent(locationId)}`,
      method: 'PUT',
      data
    })
    return { message: response.message, item: mapLocation(response.item) }
  },

  setEnabled(locationId: string, enabled: boolean): Promise<{ message: string }> {
    return request({
      url: `/api/spare-parts/${encodeURIComponent(locationId)}/enabled`,
      method: 'PUT',
      data: { enabled }
    })
  },

  delete(locationId: string, deleteHistory = false): Promise<{ message: string; sparePartId: string }> {
    return request({
      url: `/api/spare-parts/${encodeURIComponent(locationId)}`,
      method: 'DELETE',
      params: deleteHistory ? { deletehistory: true } : undefined
    })
  }
}

export const sparePartReplacementApi = {
  async getAllStatus(): Promise<SparePartReplacementStatusResponse> {
    const response = await request<unknown, { count: number; items: RawUsageStatus[] }>({
      url: '/api/spare-part-replacements/status', method: 'GET'
    })
    return { count: response.count, items: (response.items || []).map(mapStatus) }
  },

  async getStatus(locationId: string): Promise<SparePartUsageStatus> {
    const response = await request<unknown, RawUsageStatus>({
      url: `/api/spare-part-replacements/${encodeURIComponent(locationId)}/status`,
      method: 'GET'
    })
    return mapStatus(response)
  },

  async recordReplacement(params: RecordSparePartReplacementParams): Promise<RecordSparePartReplacementResponse> {
    const response = await request<unknown, {
      message: string
      record: RawReplacementRecord
      status: RawUsageStatus
    }>({
      url: '/api/spare-part-replacements/replace',
      method: 'POST',
      data: {
        sparePartId: params.locationId,
        sparePartName: params.sparePartName,
        sparePartType: params.sparePartType,
        replacementTime: params.replacementTime,
        replacedBy: params.replacedBy,
        partNo: params.partNo,
        serialNo: params.serialNo,
        remark: params.remark
      }
    })
    return {
      message: response.message,
      record: mapRecord(response.record),
      status: mapStatus(response.status)
    }
  },

  async getHistory(params: { locationId?: string; count?: number } = {}): Promise<SparePartReplacementHistoryResponse> {
    const response = await request<unknown, {
      count: number
      sparePartId: string | null
      items: RawReplacementRecord[]
    }>({
      url: '/api/spare-part-replacements/history',
      method: 'GET',
      params: { sparePartId: params.locationId, count: params.count }
    })
    return {
      count: response.count,
      locationId: response.sparePartId,
      items: (response.items || []).map(mapRecord)
    }
  }
}
