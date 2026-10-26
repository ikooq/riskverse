import {it,expect} from 'vitest';
import {validScenarios,comparable,metrics} from './scenarioStore';
import {clone,initialScene} from './model';
const sample={id:'a',name:'Исходный',createdAt:'2026-10-23T10:00:00Z',scene:initialScene};
it('validates archives and rejects duplicates or damaged scenes',()=>{expect(validScenarios([sample])).toBe(true);for(const v of [null,[sample,sample],[{...sample,scene:{}}],[{...sample,createdAt:'invalid'}],[{...sample,name:' '}],Array.from({length:9},(_,i)=>({...sample,id:String(i)}))])expect(validScenarios(v)).toBe(false)});
it('allows object rearrangements but flags incomparable routing constraints',()=>{const s=clone(initialScene);s.items[0].x=2;expect(comparable(s,initialScene)).toBe(true);s.pedestrian[0].x=3;expect(comparable(s,initialScene)).toBe(false);s.pedestrian=clone(initialScene.pedestrian);s.clearance=2;expect(comparable(s,initialScene)).toBe(false)});
it('breaks down findings instead of inventing a risk score',()=>{expect(metrics(initialScene)).toEqual({blocked:1,crossing:1,visibility:1,total:3,length:31})});
