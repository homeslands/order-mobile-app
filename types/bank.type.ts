export interface IBankConnector {
  slug: string
  xProviderId: string
  xService: string
  xOwnerNumber: string
  xOwnerType: string
  beneficiaryName: string
  virtualAccountPrefix: string
}

export interface ICreateBankConnectorRequest {
  xProviderId: string
  xService: string
  xOwnerNumber: string
  xOwnerType: string
  beneficiaryName: string
  virtualAccountPrefix: string
}

export interface IUpdateBankConnectorRequest {
  slug: string
  xProviderId: string
  xService: string
  xOwnerNumber: string
  xOwnerType: string
  beneficiaryName: string
  virtualAccountPrefix: string
}
