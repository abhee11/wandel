import {LiveContextSchema,stateURL,contextAtURL,type LiveContext,type LiveNavigation} from '../../extension/shared/liveNavigation';
import type {Repository} from '../../extension/storage/store';
export class FixtureLiveNavigation implements LiveNavigation{
 constructor(private repository:Repository){}
 async read(){const raw=sessionStorage.getItem('wandel:fixture:live');if(!raw)return null;let context=LiveContextSchema.parse(JSON.parse(raw));const record=await this.repository.get(context.workflowId);if(!record)return null;
 const next=contextAtURL(record.draft,context,location.href);if(!next)throw new Error('Return to a connected workflow screen. Your draft is preserved.');context=next;await this.remember(context);return context;}
 async remember(context:LiveContext){sessionStorage.setItem('wandel:fixture:live',JSON.stringify(context));}
 async go(url:string,context:LiveContext){await this.remember(context);location.assign(url);}
 async clear(){sessionStorage.removeItem('wandel:fixture:live');}
}
