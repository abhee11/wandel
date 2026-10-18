import {LiveContextSchema,stateURL,type LiveContext,type LiveNavigation} from '../../extension/shared/liveNavigation';
import type {Repository} from '../../extension/storage/store';
export class FixtureLiveNavigation implements LiveNavigation{
 constructor(private repository:Repository){}
 async read(){const raw=sessionStorage.getItem('wandel:fixture:live');if(!raw)return null;let context=LiveContextSchema.parse(JSON.parse(raw));const record=await this.repository.get(context.workflowId);if(!record)return null;
 if(stateURL(record.draft,context.stateId)!==location.href){const index=context.visits.reduce((found,id,i)=>stateURL(record.draft,id)===location.href?i:found,-1);if(index<0){await this.clear();return null;}context={...context,stateId:context.visits[index],visits:context.visits.slice(0,index)};}await this.remember(context);return context;}
 async remember(context:LiveContext){sessionStorage.setItem('wandel:fixture:live',JSON.stringify(context));}
 async go(url:string,context:LiveContext){await this.remember(context);location.assign(url);}
 async clear(){sessionStorage.removeItem('wandel:fixture:live');}
}
