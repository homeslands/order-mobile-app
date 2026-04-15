import { IApiResponse, IMenuItem, ISpecificMenu, ISpecificMenuRequest } from "@/types"
import { http } from "@/utils"

export async function getSpecificMenu(
    query: ISpecificMenuRequest,
  ): Promise<IApiResponse<ISpecificMenu>> {
    const response = await http.get<IApiResponse<ISpecificMenu>>(
      `/menu/specific`,
      {
        params: query,
      },
    )
    return response.data
  }
  
  export async function getPublicSpecificMenu(
    query: ISpecificMenuRequest,
  ): Promise<IApiResponse<ISpecificMenu>> {
    const response = await http.get<IApiResponse<ISpecificMenu>>(
      `/menu/specific/public`,
      {
        params: query,
      },
    )
    return response.data
  }

  export async function getSpecificMenuItem(
    slug: string,
  ): Promise<IApiResponse<IMenuItem>> {
    const response = await http.get<IApiResponse<IMenuItem>>(`/menu-item/${slug}`)
    return response.data
  }