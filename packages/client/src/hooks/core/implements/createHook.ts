import { EnumHookType } from '@/util/helper';
import { FrameworkState, undefinedValue } from '@alova/shared';
import type { AlovaGenerics, FrontRequestState, Progress, ReferingObject } from 'alova';
import { Method } from 'alova';
import { Hook, UseHookConfig } from '~/typings/clienthook';

export default <AG extends AlovaGenerics, Args extends any[]>(
  ht: EnumHookType,
  c: UseHookConfig<AG, Args>,
  eventManager: Hook<Args>['em'],
  ro: ReferingObject
) =>
  ({
    /** The method instance of the last request */
    m: undefinedValue as unknown as Method,

    /** sent method keys */
    rf: {},

    /** frontStates */
    fs: {} as FrontRequestState<
      FrameworkState<boolean, 'loading'>,
      FrameworkState<AG['Responded'], 'data'>,
      FrameworkState<Error | undefined, 'error'>,
      FrameworkState<Progress, 'downloading'>,
      FrameworkState<Progress, 'uploading'>
    >,

    /** eventManager */
    em: eventManager,

    /** hookType, useRequest=1, useWatcher=2, useFetcher=3 */
    ht,

    /** hook config */
    c,

    /** referingObject */
    ro,

    /** merged states */
    ms: {}
  }) as Hook<Args>;
