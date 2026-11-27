import { useLoginSheetStore } from '@/stores/login-sheet.store'

describe('useLoginSheetStore', () => {
  beforeEach(() => {
    useLoginSheetStore.setState({
      visible: false,
      onSuccess: null,
      onClose: null,
    })
  })

  it('lần đóng đầu tiên thắng, onClose chỉ nhận một lần', () => {
    const onClose = jest.fn()
    useLoginSheetStore.getState().open(undefined, onClose)

    useLoginSheetStore.getState().close('success')
    useLoginSheetStore.getState().close('dismissed')

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledWith('success')
    expect(useLoginSheetStore.getState().visible).toBe(false)
  })

  it('đóng khi chưa mở thì không gọi gì', () => {
    const onClose = jest.fn()
    useLoginSheetStore.setState({ onClose })

    useLoginSheetStore.getState().close('dismissed')

    expect(onClose).not.toHaveBeenCalled()
  })

  it('onClose được gọi sau khi visible = false', () => {
    let visibleInCallback: boolean | null = null
    useLoginSheetStore.getState().open(undefined, () => {
      visibleInCallback = useLoginSheetStore.getState().visible
    })

    useLoginSheetStore.getState().close('navigated')

    expect(visibleInCallback).toBe(false)
  })

  it('open() không tham số vẫn chạy', () => {
    useLoginSheetStore.getState().open()

    const s = useLoginSheetStore.getState()
    expect(s.visible).toBe(true)
    expect(s.onSuccess).toBeNull()
    expect(s.onClose).toBeNull()
  })
})
