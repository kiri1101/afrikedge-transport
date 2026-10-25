import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { testGlobal } from '@/test-utils'
import MobilePager from './MobilePager.vue'

describe('MobilePager', () => {
  it('disables previous on the first page and moves to the next one', async () => {
    const wrapper = mount(MobilePager, { props: { page: 1, pages: 3 }, global: testGlobal })
    const [previous, next] = wrapper.findAll('button')

    expect(previous!.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('1 / 3')
    await next!.trigger('click')

    expect(wrapper.emitted('change')).toEqual([[2]])
  })

  it('disables next on the last page', () => {
    const wrapper = mount(MobilePager, { props: { page: 3, pages: 3 }, global: testGlobal })

    expect(wrapper.findAll('button')[1]!.attributes('disabled')).toBeDefined()
  })
})
