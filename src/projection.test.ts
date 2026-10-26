import {describe,it,expect} from 'vitest';
import {calibrateFloor,footprintAt,pointInQuad,validProjection,validQuad} from './projection';
const quad=[{x:.3,y:.2},{x:.7,y:.2},{x:.95,y:.9},{x:.05,y:.9}];
describe('floor perspective calibration',()=>{
 it('maps every marked corner to the correct metric corner',()=>{const c=calibrateFloor(quad,24,16);const target=[{x:0,y:0},{x:24,y:0},{x:24,y:16},{x:0,y:16}];quad.forEach((p,i)=>{expect(c.toFloor(p).x).toBeCloseTo(target[i].x);expect(c.toFloor(p).y).toBeCloseTo(target[i].y)})});
 it('round trips interior metric points through a perspective photograph',()=>{const c=calibrateFloor(quad,24,16);for(const p of [{x:12,y:8},{x:1.1,y:14.2},{x:22,y:3}]){const back=c.toFloor(c.toPhoto(p));expect(back.x).toBeCloseTo(p.x,7);expect(back.y).toBeCloseTo(p.y,7)}});
 it('rejects crossed, collinear, repeated, tiny and non-finite corners',()=>{for(const q of [[quad[0],quad[2],quad[1],quad[3]],[quad[0],quad[0],quad[2],quad[3]],[{x:0,y:0},{x:.2,y:.2},{x:.4,y:.4},{x:.6,y:.6}],[{x:0,y:0},{x:.001,y:0},{x:.001,y:.001},{x:0,y:.001}],[{x:NaN,y:0},...quad.slice(1)]]){expect(validQuad(q)).toBe(false);expect(()=>calibrateFloor(q,24,16)).toThrow()}});
 it('accepts clockwise and anticlockwise outlines without flipping axis labels',()=>{const q=[quad[0],quad[3],quad[2],quad[1]],c=calibrateFloor(q,10,5);expect(c.toFloor(q[1]).x).toBeCloseTo(10);expect(c.toFloor(q[3]).y).toBeCloseTo(5)});
 it('rejects anchors beyond calibrated floor rather than extrapolating',()=>{const c=calibrateFloor(quad,24,16);expect(pointInQuad({x:.5,y:.1},quad)).toBe(false);expect(()=>c.toFloor({x:.5,y:.1})).toThrow();expect(validProjection({corners:quad,width:24,height:16,anchor:{x:.5,y:.6}})).toBe(true);expect(validProjection({corners:quad,width:24,height:16,anchor:{x:.5,y:.1}})).toBe(false)});
 it('positions the footprint around the floor anchor, not the top of an image box',()=>{expect(footprintAt({x:12,y:8},2,4)).toEqual({x:11,y:6})});
});
