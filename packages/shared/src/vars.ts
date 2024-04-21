import { GeneralFn } from './helper';

const undefStr = 'undefined';
// 以下为减少编译代码量而添加的统一处理函数或变量
export const PromiseCls = Promise as typeof Promise<any>,
  promiseResolve = <T>(value: T) => PromiseCls.resolve(value),
  promiseReject = <T>(value: T) => PromiseCls.reject(value),
  ObjectCls = Object,
  undefinedValue = undefined,
  nullValue = null,
  trueValue = true,
  falseValue = false,
  promiseThen = <T, TResult1 = T, TResult2 = never>(
    promise: Promise<T>,
    onFulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): Promise<TResult1 | TResult2> => promise.then(onFulfilled, onrejected),
  promiseCatch = <T, TResult = never>(
    promise: Promise<T>,
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null
  ) => promise.catch(onrejected),
  promiseFinally = <T>(promise: Promise<T>, onfinally?: (() => void) | undefined | null) => promise.finally(onfinally),
  JSONStringify = <T>(value: T) => JSON.stringify(value),
  JSONParse = (value: string) => JSON.parse(value),
  setTimeoutFn = (fn: GeneralFn, delay = 0) => setTimeout(fn, delay),
  clearTimeoutTimer = (timer: NodeJS.Timeout | string | number) => clearTimeout(timer),
  objectKeys = (obj: object) => ObjectCls.keys(obj),
  forEach = <T>(ary: T[], fn: (item: T, index: number, ary: T[]) => void) => ary.forEach(fn),
  pushItem = <T>(ary: T[], ...item: T[]) => ary.push(...item),
  mapItem = <T, R>(ary: T[], callbackfn: (value: T, index: number, array: T[]) => R) => ary.map(callbackfn),
  filterItem = <T>(ary: T[], predicate: (value: T, index: number, array: T[]) => unknown) => ary.filter(predicate),
  slice = <T>(ary: T[], start?: number, end?: number) => ary.slice(start, end),
  len = (data: any[] | Uint8Array | string) => data.length,
  isArray = (arg: any): arg is any[] => Array.isArray(arg),
  deleteAttr = <T extends Record<any, any>>(arg: T, attr: keyof T) => delete arg[attr],
  typeOf = (arg: any) => typeof arg,
  noBrowserWin = typeof window === undefStr || !window.location,
  // 是否为服务端运行，为了兼容浏览器以及非web客户端环境（如小程序），需要再判断一下process
  isSSR = noBrowserWin && typeof process !== undefStr;
