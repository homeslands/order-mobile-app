import { numberToVietnameseWords } from '@/utils/number-to-vietnamese-words'

describe('numberToVietnameseWords', () => {
  it.each([
    [0, 'Không'],
    [5, 'Năm'],
    [10, 'Mười'],
    [15, 'Mười lăm'],
    [21, 'Hai mươi mốt'],
    [24, 'Hai mươi bốn'],
    [25, 'Hai mươi lăm'],
    [100, 'Một trăm'],
    [105, 'Một trăm linh năm'],
    [110, 'Một trăm mười'],
    [1000, 'Một nghìn'],
    [1005, 'Một nghìn không trăm linh năm'],
    [6400, 'Sáu nghìn bốn trăm'],
    [22400, 'Hai mươi hai nghìn bốn trăm'],
    [390600, 'Ba trăm chín mươi nghìn sáu trăm'],
    [1000000, 'Một triệu'],
    [2050000, 'Hai triệu không trăm năm mươi nghìn'],
    [1000000000, 'Một tỷ'],
  ])('%i → %s', (n, words) => {
    expect(numberToVietnameseWords(n)).toBe(words)
  })

  it('làm tròn xuống và bỏ dấu âm cho số không hợp lệ', () => {
    expect(numberToVietnameseWords(6400.7)).toBe('Sáu nghìn bốn trăm')
    expect(numberToVietnameseWords(-5)).toBe('Không')
  })
})
