export enum PrinterDataType {
    TSPL_ZPL = 'tspl-zpl',
    ESC_POS = 'esc-pos',
  }
  
  export enum PrinterJobStatus {
    PENDING = 'pending',
    PRINTING = 'printing',
    PRINTED = 'printed',
    FAILED = 'failed'
  }
  
  export enum PrinterJobType {
    LABEL_TICKET = 'label-ticket',
    INVOICE = 'invoice',
    CHEF_ORDER = 'chef-order',
  }