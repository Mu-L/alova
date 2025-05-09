import { mockRequestAdapter } from '#/mockData';
import {
  AlovaEventBase,
  ScopedSQCompleteEvent,
  ScopedSQErrorEvent,
  ScopedSQEvent,
  ScopedSQSuccessEvent
} from '@/event';
import { SilentMethod } from '@/hooks/silent/SilentMethod';
import { setSilentFactoryStatus } from '@/hooks/silent/globalVariables';
import { bootSilentFactory, onSilentSubmitSuccess } from '@/hooks/silent/silentFactory';
import { silentQueueMap } from '@/hooks/silent/silentQueue';
import loadSilentQueueMapFromStorage from '@/hooks/silent/storage/loadSilentQueueMapFromStorage';
import useSQRequest from '@/hooks/silent/useSQRequest';
import Undefined from '@/hooks/silent/virtualResponse/Undefined';
import createVirtualResponse from '@/hooks/silent/virtualResponse/createVirtualResponse';
import dehydrateVData from '@/hooks/silent/virtualResponse/dehydrateVData';
import stringifyVData from '@/hooks/silent/virtualResponse/stringifyVData';
import updateStateEffect from '@/hooks/silent/virtualResponse/updateStateEffect';
import { symbolVDataId } from '@/hooks/silent/virtualResponse/variables';
import { accessAction, actionDelegationMiddleware } from '@/index';
import VueHook from '@/statesHook/vue';
import { AlovaGenerics, createAlova } from 'alova';
import { delay, untilCbCalled } from 'root/testUtils';
import { SQHookBehavior } from '~/typings/clienthook';

const alovaInst = createAlova({
  baseURL: process.env.NODE_BASE_URL,
  statesHook: VueHook,
  requestAdapter: mockRequestAdapter,
  cacheFor: {
    // Do not set the cache, otherwise some will not be delayed by 50 milliseconds due to caching, resulting in inconsistent results.
    GET: 0
  }
});

let testNum = 0;
beforeEach(() => {
  // Reset the status to 1 before each use case is run, otherwise the above request error will change the status to 2 and the following silentMethod will no longer be executed.
  // Since it has not been started for the first time, there is no need to reset it.
  testNum > 0 && setSilentFactoryStatus(1);
  testNum += 1;
});

beforeAll(() => {
  bootSilentFactory({
    alova: alovaInst
  });
});
describe('vue => useSQRequest', () => {
  test('request immediately with queue behavior', async () => {
    const queue = 'tb1';
    const Get = alovaInst.Get<{ total: number; list: number[] }>('/list');
    const beforePushMockFn = vi.fn();
    const pushedMockFn = vi.fn();
    const completeMockFn = vi.fn();
    const { loading, data, error, downloading, uploading, onSuccess } = useSQRequest(() => Get, {
      queue
    })
      .onBeforePushQueue(event => {
        beforePushMockFn(event, [...silentQueueMap[queue]]);
      })
      .onPushedQueue(event => {
        pushedMockFn(event, [...silentQueueMap[queue]]);
      })
      .onComplete(event => {
        completeMockFn(event);
      });

    expect(loading.value).toBeTruthy();
    expect(data.value).toBeUndefined();
    expect(downloading.value).toStrictEqual({ total: 0, loaded: 0 });
    expect(uploading.value).toStrictEqual({ total: 0, loaded: 0 });
    expect(error.value).toBeUndefined();
    // The success callback parameter is changed to the event object through decorate event, so it is forced to this object.
    const scopedSQSuccessEvent = (await untilCbCalled(onSuccess)) as unknown as ScopedSQSuccessEvent<AlovaGenerics>;
    expect(loading.value).toBeFalsy();
    expect(data.value.total).toBe(300);
    expect(data.value.list).toStrictEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(downloading.value).toStrictEqual({ total: 0, loaded: 0 });
    expect(uploading.value).toStrictEqual({ total: 0, loaded: 0 });
    expect(error.value).toBeUndefined();

    expect(scopedSQSuccessEvent).toBeInstanceOf(ScopedSQSuccessEvent);
    expect(scopedSQSuccessEvent.behavior).toBe('queue');
    expect(scopedSQSuccessEvent.method).toBe(Get);
    expect(scopedSQSuccessEvent.data.total).toBe(300);
    expect(scopedSQSuccessEvent.data.list).toStrictEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(scopedSQSuccessEvent.args).toStrictEqual([]);
    expect(!!scopedSQSuccessEvent.silentMethod).toBeTruthy();

    expect(beforePushMockFn).toHaveBeenCalledTimes(1);
    const [beforePushEvent, currentQueueStageBeforePush] = beforePushMockFn.mock.calls[0];
    expect(beforePushEvent).toBeInstanceOf(ScopedSQEvent);
    expect(beforePushEvent.behavior).toBe('queue');
    expect(beforePushEvent.method).toBe(Get);
    expect(beforePushEvent.silentMethod).toBeInstanceOf(SilentMethod);
    expect(beforePushEvent.args).toStrictEqual([]);
    expect(currentQueueStageBeforePush).toHaveLength(0);

    expect(pushedMockFn).toHaveBeenCalledTimes(1);
    const [pushedEvent, currentQueueStagePushed] = pushedMockFn.mock.calls[0];
    expect(pushedEvent).toBeInstanceOf(ScopedSQEvent);
    expect(pushedEvent.behavior).toBe('queue');
    expect(pushedEvent.method).toBe(Get);
    expect(pushedEvent.silentMethod).toBeInstanceOf(SilentMethod);
    expect(pushedEvent.args).toStrictEqual([]);
    expect(currentQueueStagePushed).toHaveLength(1);
    expect(currentQueueStagePushed[0]).toBe(pushedEvent.silentMethod);

    expect(completeMockFn).toHaveBeenCalledTimes(1);
    const completedEvent = completeMockFn.mock.calls[0][0];
    expect(completedEvent).toBeInstanceOf(ScopedSQCompleteEvent);
    expect(completedEvent.behavior).toBe('queue');
    expect(completedEvent.method).toBe(Get);
    expect(completedEvent.data.total).toBe(300);
    expect(completedEvent.data.list).toStrictEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(completedEvent.args).toStrictEqual([]);
    expect(!!completedEvent.silentMethod).toBeTruthy();

    expect(Object.keys(silentQueueMap[queue])).toHaveLength(0);
  });

  test('should receive params when call send function by behavior `queue`', async () => {
    const queue = 'tb21';
    const Get = alovaInst.Get<{ total: number; list: number[] }>('/list');
    const methodHandlerMockFn = vi.fn();
    const behaviorMockFn = vi.fn();
    const forceMockFn = vi.fn();
    const { send } = useSQRequest(
      (arg1, arg2) => {
        methodHandlerMockFn(arg1, arg2);
        return Get;
      },
      {
        queue,
        immediate: false,
        behavior(event) {
          behaviorMockFn(event);
          return 'queue';
        },
        force(event) {
          forceMockFn(event);
          return false;
        }
      }
    );

    const response = await send(1, 2);
    expect(response).toStrictEqual({
      total: 300,
      list: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    });
    expect(methodHandlerMockFn.mock.calls[0][0]).toBe(1);
    expect(methodHandlerMockFn.mock.calls[0][1]).toBe(2);
    expect(behaviorMockFn.mock.calls[0][0]).toStrictEqual(AlovaEventBase.spawn(Get, [1, 2]));
    expect(forceMockFn.mock.calls[0][0]).toStrictEqual(AlovaEventBase.spawn(Get, [1, 2]));
  });

  test('should force request when set force to true in silent queue', async () => {
    const queue = 'tb31';
    const Get = alovaInst.Get<{ total: number; list: number[] }>('/list');
    const { send, onSuccess } = useSQRequest(() => Get, {
      queue,
      force() {
        return true;
      }
    });

    await untilCbCalled(onSuccess);
    await send();
    expect(Get.fromCache).toBeFalsy();
  });

  test('use send function to request with queue behavior', async () => {
    const queue = 'tb2';
    const Get = (page: number, pageSize: number) =>
      alovaInst.Get<{ total: number; list: number[] }>('/list', {
        params: {
          page,
          pageSize
        }
      });
    const { data, error, downloading, uploading, send, onSuccess, onBeforePushQueue, onPushedQueue } = useSQRequest(
      (page, pageSize) => Get(page, pageSize),
      {
        immediate: false,
        queue
      }
    );

    const beforePushMockFn = vi.fn();
    onBeforePushQueue(event => {
      beforePushMockFn(event);
    });
    const pushedMockFn = vi.fn();
    onPushedQueue(event => {
      pushedMockFn(event);
    });

    send(2, 8); // Send request
    expect(data.value).toBeUndefined();
    expect(downloading.value).toStrictEqual({ total: 0, loaded: 0 });
    expect(uploading.value).toStrictEqual({ total: 0, loaded: 0 });
    expect(error.value).toBeUndefined();
    // Decorate event
    const scopedSQSuccessEvent = (await untilCbCalled(onSuccess)) as unknown as ScopedSQSuccessEvent<AlovaGenerics>;
    expect(data.value.total).toBe(300);
    expect(data.value.list).toStrictEqual([8, 9, 10, 11, 12, 13, 14, 15]);
    expect(downloading.value).toStrictEqual({ total: 0, loaded: 0 });
    expect(uploading.value).toStrictEqual({ total: 0, loaded: 0 });
    expect(error.value).toBeUndefined();

    expect(scopedSQSuccessEvent.behavior).toBe('queue');
    expect(scopedSQSuccessEvent.data.total).toBe(300);
    expect(scopedSQSuccessEvent.data.list).toStrictEqual([8, 9, 10, 11, 12, 13, 14, 15]);
    expect(scopedSQSuccessEvent.args).toStrictEqual([2, 8]);
    expect(!!scopedSQSuccessEvent.silentMethod).toBeTruthy();

    expect(beforePushMockFn).toHaveBeenCalledTimes(1);
    const [beforePushEvent] = pushedMockFn.mock.calls[0];
    expect(beforePushEvent.behavior).toBe('queue');
    expect(beforePushEvent.method.url).toBe('/list');
    expect(beforePushEvent.method.config.params).toStrictEqual({ page: 2, pageSize: 8 });
    expect(beforePushEvent.silentMethod).toBeInstanceOf(SilentMethod);
    expect(beforePushEvent.args).toStrictEqual([2, 8]);

    expect(pushedMockFn).toHaveBeenCalledTimes(1);
    const [pushedEvent] = pushedMockFn.mock.calls[0];
    expect(pushedEvent.behavior).toBe('queue');
    expect(pushedEvent.method.url).toBe('/list');
    expect(pushedEvent.method.config.params).toStrictEqual({ page: 2, pageSize: 8 });
    expect(pushedEvent.silentMethod).toBeInstanceOf(SilentMethod);
    expect(pushedEvent.args).toStrictEqual([2, 8]);
  });

  test('should emit onError immediately while request error and never retry', async () => {
    const queue = 'tb3';
    const Get = () => alovaInst.Get<never>('/list-error');
    const { data, error, onError, onComplete } = useSQRequest(Get, {
      behavior: 'queue',
      queue
    });

    const completeMockFn = vi.fn();
    onComplete(event => {
      completeMockFn(event);
    });
    // Decorate event
    const scopedSQErrorEvent = (await untilCbCalled(onError)) as unknown as ScopedSQErrorEvent<AlovaGenerics>;
    expect(data.value).toBeUndefined();
    expect(error.value?.message).toBe('server error');

    expect(scopedSQErrorEvent).toBeInstanceOf(ScopedSQErrorEvent);
    expect(scopedSQErrorEvent.behavior).toBe('queue');
    expect(scopedSQErrorEvent.error.message).toBe('server error');
    expect(scopedSQErrorEvent.args).toStrictEqual([]);
    expect(scopedSQErrorEvent.silentMethod).not.toBeUndefined();
    expect(silentQueueMap[queue]).toHaveLength(0); // removed from queue

    const [completedEvent] = completeMockFn.mock.calls[0];
    expect(completedEvent).toBeInstanceOf(ScopedSQCompleteEvent);
    expect(completedEvent.behavior).toBe('queue');
    expect(completedEvent.error.message).toBe('server error');
    expect(completedEvent.args).toStrictEqual([]);
    expect(completedEvent.silentMethod).not.toBeUndefined();
  });

  test('should prevent to push silentMethod when return false in certain callback of onBeforePushQueue', async () => {
    const queue = 'tb4';
    const successMockFn = vi.fn();
    const Get = () => alovaInst.Get<any>('/list');
    const { onBeforePushQueue } = useSQRequest(Get, {
      behavior: 'queue',
      queue
    }).onSuccess(successMockFn);
    const { onBeforePushQueue: onBeforePushQueueAsync } = useSQRequest(Get, {
      behavior: 'queue',
      queue
    }).onSuccess(successMockFn);
    onBeforePushQueue(() => false);
    onBeforePushQueueAsync(() => Promise.resolve(false));

    await delay(0);
    expect(silentQueueMap[queue]).toStrictEqual([]);
    await delay(500);
    expect(successMockFn).not.toHaveBeenCalled();

    const { onBeforePushQueue: onBeforePushQueue2, onSuccess: onSuccess2 } = useSQRequest(Get, {
      behavior: 'queue',
      queue
    });
    onBeforePushQueue2(() => {});
    onBeforePushQueue2(() => true);
    onSuccess2(successMockFn);
    await delay(0);
    expect(silentQueueMap[queue]?.[0]?.active).toBeTruthy();
    await delay(500);
    expect(successMockFn).toHaveBeenCalledTimes(1);
  });

  test('should be the same as useRequest when behavior is static', async () => {
    const queue = 'tb5';
    const Get = () => alovaInst.Get<never>('/list');
    const { loading, data, error, onSuccess, onBeforePushQueue, onPushedQueue } = useSQRequest(Get, {
      behavior: () => 'static',
      queue
    });

    const pushMockFn = vi.fn();
    onBeforePushQueue(pushMockFn);
    onPushedQueue(pushMockFn);

    await delay(0);
    // In Static behavior mode, it will not enter the queue and needs to be checked asynchronously.
    expect(silentQueueMap.a10).toBeUndefined();

    expect(loading.value).toBeTruthy();
    expect(data.value).toBeUndefined();
    // Decorate event
    const scopedSQSuccessEvent = (await untilCbCalled(onSuccess)) as unknown as ScopedSQSuccessEvent<AlovaGenerics>;
    expect(pushMockFn).toHaveBeenCalledTimes(0);
    expect(loading.value).toBeFalsy();
    expect(data.value).toStrictEqual({
      total: 300,
      list: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    });
    expect(error.value).toBeUndefined();
    expect(scopedSQSuccessEvent.behavior).toBe('static');
    expect(scopedSQSuccessEvent.data).toStrictEqual({
      total: 300,
      list: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    });
    expect(scopedSQSuccessEvent.args).toStrictEqual([]);
    expect(scopedSQSuccessEvent.method).not.toBeUndefined();
    expect(scopedSQSuccessEvent.silentMethod).toBeUndefined();
  });

  test('should be persisted when has no fallbackHandlers in silent behavior', async () => {
    const queue = 'tb6';
    const Get = () => alovaInst.Get<never>('/list');
    useSQRequest(Get, {
      behavior: () => 'silent',
      queue
    });

    await untilCbCalled(setTimeout, 0);
    expect(silentQueueMap[queue]).toHaveLength(1);
    let persistentSilentQueueMap = await loadSilentQueueMapFromStorage();
    expect(persistentSilentQueueMap[queue]).toHaveLength(1);

    // second request
    const { onFallback } = useSQRequest(() => alovaInst.Get<any>('/list-error'), {
      behavior: () => 'silent',
      queue,
      retryError: /.*/,
      maxRetryTimes: 2
    });
    const fallbackMockFn = vi.fn();
    onFallback(event => {
      fallbackMockFn(event);
    });

    await delay(0);
    expect(silentQueueMap[queue].length).toBe(2);
    persistentSilentQueueMap = await loadSilentQueueMapFromStorage();
    expect(persistentSilentQueueMap[queue].length).toBe(1); // It will not be persisted when on fallback is bound.
    await untilCbCalled(onFallback);

    const [fallbackEvent] = fallbackMockFn.mock.calls[0];
    expect(fallbackEvent.behavior).toBe('silent');
    expect(fallbackEvent.method).not.toBeUndefined();
    expect(fallbackEvent.silentMethod).toBeInstanceOf(SilentMethod);
    expect(fallbackEvent.args).toStrictEqual([]);
  });

  test('should be change behavior when param behavior set to a function that return different value', async () => {
    const queue = 'tb7';
    const poster = () => alovaInst.Post<any>('/detail');
    let behaviorStr: SQHookBehavior = 'silent';
    const { data, onSuccess, send } = useSQRequest(poster, {
      behavior: () => behaviorStr,
      queue
    });
    let event = (await untilCbCalled(onSuccess)) as unknown as ScopedSQSuccessEvent<AlovaGenerics>;
    expect(data.value).toBeInstanceOf(Undefined);
    expect(data.value[symbolVDataId]).not.toBeUndefined();
    expect(event.data).toBeInstanceOf(Undefined);
    expect(event.data[symbolVDataId]).not.toBeUndefined();
    expect(event.behavior).toBe('silent');
    expect(event.args).toStrictEqual([]);

    behaviorStr = 'static';
    send(1, 2, 3);
    event = (await untilCbCalled(onSuccess)) as unknown as ScopedSQSuccessEvent<AlovaGenerics>;
    expect(data.value).toStrictEqual({ id: 1 });
    expect(event.data).toStrictEqual({ id: 1 });
    expect(event.behavior).toBe('static');
    expect(event.args).toStrictEqual([1, 2, 3]);
  });

  test('should be intercepted when has virtual data in method instance', async () => {
    const queue = 'tb8';
    const vDataId = createVirtualResponse(undefined);
    const poster = (id: number) => alovaInst.Post<any>('/detail', { id });
    const { data, onSuccess } = useSQRequest(() => poster(vDataId), {
      behavior: 'queue',
      queue,
      vDataCaptured(method) {
        expect(method.url).toBe('/detail');
        expect(method.type).toBe('POST');
        expect((method.data as any).id).toBe(vDataId);
        return {
          localData: 'abc'
        };
      }
    });

    let event = (await untilCbCalled(onSuccess)) as unknown as ScopedSQSuccessEvent<AlovaGenerics>;
    expect(event.data).toStrictEqual({ localData: 'abc' });
    expect(data.value).toStrictEqual({ localData: 'abc' });

    // Second: Test the situation where v data captured is not set and a request will be sent.
    const { data: data2, onSuccess: onSuccess2 } = useSQRequest(() => poster(vDataId), {
      behavior: 'queue',
      queue
    });
    event = (await untilCbCalled(onSuccess2)) as unknown as ScopedSQSuccessEvent<AlovaGenerics>;
    expect(event.data).toStrictEqual({ id: 1 });
    expect(data2.value).toStrictEqual({ id: 1 });
  });

  test('should be intercepted when has virtual data id string in method instance', async () => {
    const queue = 'tb9';
    const vDataId = createVirtualResponse(undefined);
    const poster = (id: number) =>
      alovaInst.Post<any>('/detail', {
        id: `id is ${stringifyVData(id)}`
      });
    const { data, onSuccess } = useSQRequest(() => poster(vDataId), {
      behavior: 'static', // V data captured is valid in any behavior mode
      queue,
      vDataCaptured() {
        return {
          localData: 'abc'
        };
      }
    });

    const event = (await untilCbCalled(onSuccess)) as unknown as ScopedSQSuccessEvent<AlovaGenerics>;
    expect(event.data).toStrictEqual({ localData: 'abc' });
    expect(data.value).toStrictEqual({ localData: 'abc' });
  });

  test('should be intercepted when use virtual data to calculate in method instance', async () => {
    const queue = 'tb10';
    const vDataId = createVirtualResponse(undefined);
    const obj = { vDataId };

    const poster = (o: { vDataId: any }) =>
      alovaInst.Post<any>('/detail', {
        status: dehydrateVData(o.vDataId) ? 1 : 0
      });
    const { data, onSuccess } = useSQRequest(() => poster(obj), {
      behavior: 'queue',
      queue,
      vDataCaptured() {
        return {
          localData: 'abc'
        };
      }
    });

    const event = (await untilCbCalled(onSuccess)) as unknown as ScopedSQSuccessEvent<AlovaGenerics>;
    expect(event.data).toStrictEqual({ localData: 'abc' });
    expect(data.value).toStrictEqual({ localData: 'abc' });
  });

  test('the onSuccess should be emit immediately with virtualResponse, perhaps has default response', async () => {
    const queue = 'tb11';
    const poster = () => alovaInst.Post<any>('/detail');
    const { data, onSuccess } = useSQRequest(poster, {
      behavior: 'silent',
      queue
    });

    const event = (await untilCbCalled(onSuccess)) as unknown as ScopedSQSuccessEvent<AlovaGenerics>;
    expect(event.behavior).toBe('silent');
    expect(event.method).not.toBeUndefined();
    expect(event.silentMethod).not.toBeUndefined();
    expect(event.args).toStrictEqual([]);
    expect(data.value[symbolVDataId]).toBeTruthy();
    expect(dehydrateVData(event.data)).toBeUndefined();
    expect(dehydrateVData(data.value)).toBeUndefined();

    const { data: data2, onSuccess: onSuccess2 } = useSQRequest(poster, {
      behavior: 'silent',
      queue,
      silentDefaultResponse: () => ({
        a: 1,
        b: 'bb'
      })
    });
    const event2 = (await untilCbCalled(onSuccess2)) as unknown as ScopedSQSuccessEvent<AlovaGenerics>;
    expect(data2.value[symbolVDataId]).not.toBeUndefined();
    expect(data2.value.a.toFixed(2)).toBe('1.00');
    expect(data2.value.b.replace('b', 'a')).toBe('ab');

    expect(dehydrateVData(event2.data)).toStrictEqual({ a: 1, b: 'bb' });
    expect(dehydrateVData(data2.value)).toStrictEqual({ a: 1, b: 'bb' });
  });

  test('should be delay update states when call `updateStateEffect` in onSuccess handler', async () => {
    // Get list
    const queue = 'tb12';
    const getter = () => alovaInst.Get<any>('/info-list');
    const { data: listData, onSuccess } = useSQRequest(getter, {
      queue
    });
    await untilCbCalled(onSuccess);
    expect(listData.value).toStrictEqual([
      {
        id: 10,
        text: 'a'
      },
      {
        id: 20,
        text: 'b'
      },
      {
        id: 30,
        text: 'c'
      }
    ]);

    // Submit data and update immediately
    const poster = () => alovaInst.Post<any>('/detail');
    const { data: postRes, onSuccess: onPostSuccess } = useSQRequest(poster, {
      behavior: 'silent',
      queue,
      silentDefaultResponse: () => ({
        id: '--'
      })
    });
    onPostSuccess(async event => {
      const { data } = event;
      expect(postRes.value[symbolVDataId]).toBeTruthy(); // At this time it is still virtual response data

      // After calling updateStateEffect, the virtual data will be updated immediately into listData.
      // Wait until the request responds and update the actual data to listData again.
      const updated = await updateStateEffect(getter(), listDataRaw => {
        listDataRaw.push({
          id: data.id,
          text: 'abc'
        });
        return listDataRaw;
      });
      expect(updated).toBeTruthy();

      const listDataLastItem = listData.value[listData.value.length - 1];
      expect(stringifyVData(listDataLastItem?.id)).toBe(stringifyVData(data.id));
      expect(dehydrateVData(listDataLastItem?.id)).toBe('--'); // Dummy data default value
      expect(listDataLastItem?.text).toBe('abc');
    });

    await new Promise<void>(resolve => {
      onSilentSubmitSuccess(event => {
        if (event.queueName === queue) {
          resolve();
        }
      });
    });
    // Replaced with actual data
    expect(postRes.value).toStrictEqual({ id: 1 });

    // List data is also replaced with actual data
    expect(listData.value).toStrictEqual([
      {
        id: 10,
        text: 'a'
      },
      {
        id: 20,
        text: 'b'
      },
      {
        id: 30,
        text: 'c'
      },
      {
        id: 1,
        text: 'abc'
      }
    ]);
  });

  test('should replace virtual data to real value that method instances after requesting method instance', async () => {
    // Submit data and update immediately
    const queue = 'tb13';
    const poster = (data: Record<string, any>) => alovaInst.Post<any>('/detail2', data);
    const { onSuccess: onPostSuccess } = useSQRequest(
      () =>
        poster({
          text: 'aaa',
          status: 1
        }),
      {
        behavior: 'silent',
        queue,
        silentDefaultResponse() {
          return {
            id: null,
            text: null,
            status: null
          };
        }
      }
    );

    let vDataId: number | void;
    let vDataStatus: boolean | void;
    let vDataText: string | void;
    onPostSuccess(({ data }) => {
      vDataId = data.id;
      vDataStatus = data.status;
      vDataText = data.text;
    });

    await untilCbCalled(onPostSuccess);
    const { onSuccess: onPostSuccess2 } = useSQRequest(
      () =>
        poster({
          text: 'bbb',
          status: 2
        }),
      {
        behavior: 'silent',
        queue,
        silentDefaultResponse() {
          return {
            id: undefined,
            text: undefined,
            status: undefined
          };
        }
      }
    );

    let vDataId2: number | void;
    let vDataStatus2: boolean | void;
    let vDataText2: string | void;
    onPostSuccess2(({ data }) => {
      vDataId2 = data.id;
      vDataStatus2 = data.status;
      vDataText2 = data.text;
    });
    await untilCbCalled(onPostSuccess2);

    const deleter = () =>
      alovaInst.Delete<any>(`/detail/${stringifyVData(vDataId) + stringifyVData(vDataId2)}`, {
        text1: vDataText,
        text2: vDataText2,
        status: [vDataStatus, vDataStatus2]
      });
    const { onSuccess: onDeleteSuccess } = useSQRequest(deleter, {
      behavior: 'queue',
      queue
    });

    // Use global events to check the above request data
    onSilentSubmitSuccess(event => {
      if (event.method.type === 'DELETE' && event.behavior === 'queue') {
        expect(event.method.url).toBe('/detail/1010');
        expect(event.method.data).toStrictEqual({
          text1: 'aaa',
          text2: 'bbb',
          status: [1, 2]
        });
      }
    });

    const resRaw = await untilCbCalled(onDeleteSuccess);
    expect(resRaw.data).toStrictEqual({
      params: {
        id: '1010'
      },
      data: {
        text1: 'aaa',
        text2: 'bbb',
        status: [1, 2]
      }
    });
  });

  test('should access actions by middleware actionDelegation', async () => {
    const queue = 'tb33221';
    const Get = alovaInst.Get<{ total: number; list: number[] }>('/list');
    const { onSuccess, onComplete } = useSQRequest(() => Get, {
      queue,
      behavior: 'queue',
      middleware: actionDelegationMiddleware('test_page')
    });

    const successFn = vi.fn();
    const completeFn = vi.fn();
    onSuccess(successFn);
    onComplete(completeFn);

    await untilCbCalled(onSuccess);
    expect(successFn).toHaveBeenCalledTimes(1);
    expect(completeFn).toHaveBeenCalledTimes(1);

    const accessActionMockFn = vi.fn();
    accessAction('test_page', handlers => {
      accessActionMockFn(handlers);
      handlers.send();
    });

    await untilCbCalled(onSuccess);
    expect(successFn).toHaveBeenCalledTimes(2);
    expect(completeFn).toHaveBeenCalledTimes(2);

    const handlers = accessActionMockFn.mock.calls[0][0];
    expect(handlers.send).toBeInstanceOf(Function);
    expect(handlers.abort).toBeInstanceOf(Function);
  });
});
