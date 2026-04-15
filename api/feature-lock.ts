import { IApiResponse, IFeatureLock } from '@/types';
import { http } from '@/utils';

export async function getSystemFeatureFlagsByGroup(
  groupName: string,
): Promise<IApiResponse<IFeatureLock[]>> {
  const response = await http.get<IApiResponse<IFeatureLock[]>>(
    `/feature-flag-system/group/${groupName}`,
  )
  return response.data
}

export async function getFeatureFlagsByGroup(
  group: string,
): Promise<IApiResponse<IFeatureLock[]>> {
  const response = await http.get<IApiResponse<IFeatureLock[]>>(
    `/feature-flag`,
    { params: { group } },
  )
  return response.data
}
