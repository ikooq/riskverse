import {expect,it} from 'vitest';
import {analyze,segmentRect,validScene} from './model';
import {compareScenes} from './comparison';
import {demonstrationScene,demoPlacements,placeDemoPallet} from './demo';
import {readFileSync} from 'node:fs';
import {parseArchive} from './auditArchive';

it('ships a valid saved AI demonstration with matching source and no private recovery snapshot',()=>{
 const sample=parseArchive(JSON.parse(readFileSync(new URL('../public/demo/verified-ai-audit.json',import.meta.url),'utf8')));
 expect(sample.photo).toBeTruthy();expect(sample.photoMeta.id).toBe(sample.scene.source?.id);
 expect(sample.photoSession?.vision?.model).toBe('gemini-3.1-flash-lite');
 expect(sample.photoSession?.vision?.report.observations.length).toBeGreaterThan(0);
 expect(sample.recovery).toBeUndefined();expect(sample.scene.items.every(i=>i.evidence?.method==='manual')).toBe(true);
});

it('demonstrates a clearance fix that creates a visibility problem even with an unchanged total',()=>{
 const original=demonstrationScene();
 const moved=placeDemoPallet(original,demoPlacements[1]);
 expect(validScene(original)).toBe(true);expect(validScene(moved)).toBe(true);
 const result=compareScenes(moved,original);
 expect(result.comparable).toBe(true);expect(result.delta).toBe(0);
 expect(result.resolved.map(f=>[f.type,f.itemId])).toContainEqual(['blocked','p1']);
 expect(result.added.map(f=>[f.type,f.itemId])).toContainEqual(['visibility','p1']);
 const visibility=result.added.find(f=>f.type==='visibility')!;
 expect(visibility.sightline).toEqual([{x:15,y:11},{x:12,y:8}]);
 expect(segmentRect(...visibility.sightline!,moved.items.find(i=>i.id==='p1')!)).toBe(true);
 expect(moved.items.length).toBe(original.items.length);
 expect(moved.pedestrian).toEqual(original.pedestrian);expect(moved.vehicle).toEqual(original.vehicle);
 expect(original.items.find(i=>i.id==='p1')?.x).toBe(6);
});
it('offers an alternative without hiding the remaining crossing',()=>{
 const original=demonstrationScene(),moved=placeDemoPallet(original,demoPlacements[2]);
 const result=compareScenes(moved,original);
 expect(result.resolved.map(f=>f.type)).toEqual(['blocked']);expect(result.added).toEqual([]);
 expect(analyze(moved).map(f=>f.type)).toEqual(['crossing']);
 expect(validScene(moved)).toBe(true);
});
it('recomputes changed height instead of presenting a scripted visibility warning',()=>{
 const original=demonstrationScene();original.items.find(i=>i.id==='p1')!.height=1;
 const moved=placeDemoPallet(original,demoPlacements[1]);
 expect(analyze(moved).some(f=>f.type==='visibility'&&f.itemId==='p1')).toBe(false);
});
it('keeps every offered placement inside the floor and clear of other object footprints',()=>{
 for(const placement of demoPlacements){
  const next=placeDemoPallet(demonstrationScene(),placement),pallet=next.items.find(i=>i.id==='p1')!;
  expect(validScene(next)).toBe(true);
  for(const other of next.items.filter(i=>i.id!==pallet.id)){
   const overlaps=pallet.x<other.x+other.w&&pallet.x+pallet.w>other.x&&pallet.y<other.y+other.h&&pallet.y+pallet.h>other.y;
   expect(overlaps,`${placement.id} overlaps ${other.id}`).toBe(false);
  }
 }
});
