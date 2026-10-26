import {z} from 'zod';
export const observationSchema=z.object({
 id:z.string().min(1).max(40),label:z.string().min(1).max(100),
 kind:z.enum(['rack','pallet','barrier','person','vehicle','other']),
 region:z.object({x:z.number().min(0).max(1),y:z.number().min(0).max(1),w:z.number().positive().max(1),h:z.number().positive().max(1)}),
 concern:z.enum(['potential_hazard','context']),
 visibleEvidence:z.string().min(1).max(500),uncertainty:z.string().max(400),recommendation:z.string().max(400)
}).strict();
export const visionSchema=z.object({summary:z.string().max(800),limitations:z.array(z.string().max(300)).max(6),observations:z.array(observationSchema).max(12)}).strict();
export type Observation=z.infer<typeof observationSchema>;
export type VisionReport=z.infer<typeof visionSchema>;
export function parseVision(value:unknown):VisionReport{
 const data=visionSchema.parse(value);
 if(new Set(data.observations.map(o=>o.id)).size!==data.observations.length||data.observations.some(o=>o.region.x+o.region.w>1.000001||o.region.y+o.region.h>1.000001))throw Error('Invalid image regions');
 return data;
}
export const visionJsonSchema=z.toJSONSchema(visionSchema,{target:'draft-7'});
