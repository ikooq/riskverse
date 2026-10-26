import {it,expect} from 'vitest';
import {initialScene,validScene,analyze,clone,pathLength} from './model';
import {planRoute} from './planner';
import {simulate} from './simulation';
const empty={...clone(initialScene),name:'Новый участок',items:[],pedestrian:[],vehicle:[],source:{kind:'photo' as const,id:'photo-123',fileName:'floor.jpg'}};
it('can save an empty photo-based workspace without inventing routes or objects',()=>{expect(validScene(JSON.parse(JSON.stringify(empty)))).toBe(true);expect(analyze(empty)).toEqual([]);expect(pathLength(empty.pedestrian)).toBe(0);expect(planRoute(empty).ok).toBe(false)});
it('rejects unfinished single-point routes and invalid source metadata',()=>{expect(validScene({...empty,pedestrian:[{x:1,y:1}]})).toBe(false);expect(validScene({...empty,source:{kind:'photo'}})).toBe(false)});
it('runs the complete route workflow on a user-defined empty floor',()=>{const s={...empty,pedestrian:[{x:1,y:8},{x:23,y:8}],vehicle:[{x:12,y:1},{x:12,y:15}]};expect(validScene(s)).toBe(true);expect(analyze(s).filter(f=>f.type==='crossing')).toHaveLength(1);const r=simulate({path:s.pedestrian,speed:1,delay:0},{path:s.vehicle,speed:1,delay:4},1);expect(r.minDistance).toBeCloseTo(0);expect(r.closestAt).toBeCloseTo(11)});
