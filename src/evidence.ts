import type {Item, Scene} from './model';
import {validProjection,type FloorProjection} from './projection';
export type Region={x:number;y:number;w:number;h:number};
export type Evidence={sourceId:string;fileName:string;region:Region;method:'manual'|'ai_reviewed';note:string;projection?:FloorProjection};
export function validEvidence(value:unknown):value is Evidence{
 if(!value||typeof value!=='object')return false;
 const e=value as Evidence,r=e.region;
 if(e.projection!==undefined&&!validProjection(e.projection))return false;
 return typeof e.sourceId==='string'&&e.sourceId.length>0&&e.sourceId.length<=100&&typeof e.fileName==='string'&&e.fileName.length<=255&&['manual','ai_reviewed'].includes(e.method)&&typeof e.note==='string'&&e.note.length<=500&&!!r&&[r.x,r.y,r.w,r.h].every(n=>typeof n==='number'&&Number.isFinite(n))&&r.x>=0&&r.y>=0&&r.w>0&&r.h>0&&r.x+r.w<=1.000001&&r.y+r.h<=1.000001;
}
export function itemError(item:Item,scene:Scene):string|null{
 if(!item.name.trim()||item.name.length>119)return 'Введите название объекта (до 119 символов).';
 if(![item.x,item.y,item.w,item.h,item.height].every(Number.isFinite))return 'Заполните все размеры и координаты.';
 if(item.w<.2||item.h<.2||item.height<.2||item.height>20)return 'Размеры должны быть от 0,2 м, высота — до 20 м.';
 if(item.x<0||item.y<0||item.x+item.w>scene.width||item.y+item.h>scene.height)return 'Объект выходит за границы площадки.';
 if(scene.items.length>=100)return 'В сцене уже 100 объектов.';
 if(!validEvidence(item.evidence))return 'Сначала выделите объект на фото.';
 return null;
}
