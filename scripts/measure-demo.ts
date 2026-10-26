import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {analyze,clone,pathLength,validScene,type Scene} from '../src/model';
import {demonstrationScene,demoPlacements,placeDemoPallet} from '../src/demo';
import {simulate} from '../src/simulation';
import {planRoute} from '../src/planner';
import {defaultMotion} from '../src/auditArchive';

// Run the actual product algorithms; no network, browser storage or API calls.
const out=resolve(process.argv[2]??'output/evidence');
const original=demonstrationScene();
const nearby=placeDemoPallet(original,demoPlacements.find(p=>p.id==='nearby')!);
const alternative=placeDemoPallet(original,demoPlacements.find(p=>p.id==='alternative')!);
const short=clone(nearby);short.items.find(i=>i.id==='p1')!.height=1;
const route=planRoute(alternative);
const scenes:{name:string;scene:Scene}[]=[
 {name:'Исходное размещение',scene:original},
 {name:'Перенос к пересечению',scene:nearby},
 {name:'Перенос к стене',scene:alternative},
 {name:'У пересечения, высота паллет 1 м',scene:short},
 ...(route.ok?[{name:'У стены + найденный обход',scene:{...alternative,pedestrian:route.path}}]:[]),
];
const rows=scenes.map(({name,scene})=>{
 if(!validScene(scene))throw Error(`Invalid measurement scene: ${name}`);
 const findings=analyze(scene);
 return {name,scene,findings,total:findings.length,blocked:findings.filter(f=>f.type==='blocked').length,
 crossing:findings.filter(f=>f.type==='crossing').length,visibility:findings.filter(f=>f.type==='visibility').length,
 pathMeters:pathLength(scene.pedestrian)};
});
const has=(scene:Scene,type:string)=>analyze(scene).some(f=>f.type===type&&f.itemId==='p1');
if(!has(original,'blocked')||has(nearby,'blocked')||!has(nearby,'visibility')||has(alternative,'visibility')||has(short,'visibility'))
 throw Error('Demonstration no longer supports the stated before/after explanation. Review the narrative.');
const {walking,driving,threshold}=defaultMotion;
const motion=[0,5.9].map(delay=>({walking,driving,delay,threshold,
 ...simulate({path:original.pedestrian,speed:walking,delay:0},{path:original.vehicle,speed:driving,delay},threshold)}));
const files=['src/model.ts','src/demo.ts','src/simulation.ts','src/planner.ts','src/auditArchive.ts'];
const hashes=Object.fromEntries(await Promise.all(files.map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')])));
const report={generatedAt:new Date().toISOString(),provenance:'Real warehouse photo; manual instructional geometry. No AI inference or real-world outcome measurement.',hashes,rows,motion,planner:route};
const f=(n:number)=>n.toFixed(2);
const markdown=`# RISKVERSE — воспроизводимые измерения\n\nСоздано: ${report.generatedAt}. Команда: \`npx --no-install tsx scripts/measure-demo.ts\`.\n\nИсточник: настоящая фотография склада, ручная учебная модель, условные размеры и маршруты. Это расчёты прототипа, а не измерение реального склада или качества AI.\n\n## Изменение планировки\n\n| Вариант | Всего замечаний | Занятые коридоры | Пересечения | Ограничения обзора | Длина пути, м |\n|---|---:|---:|---:|---:|---:|\n${rows.map(r=>`| ${r.name} | ${r.total} | ${r.blocked} | ${r.crossing} | ${r.visibility} | ${f(r.pathMeters)} |`).join('\n')}\n\nПеренос к пересечению убирает блокировку от паллет p1 и создаёт ограничение обзора. Перенос к стене устраняет это ограничение. При высоте 1 м модель обзора не выдаёт замечание от этих паллет: используется порог 1,5 м. Одинаковое число замечаний может скрывать разный состав проблем.\n\nПоиск обхода: ${route.ok?`успешен; отделён от транспортного коридора: ${route.separated?'да':'нет'}`:route.reason}. Путь на сетке 0,5 м; это не доказательство глобального оптимума.\n\n## Время движения на исходных маршрутах\n\nПешеход ${walking} м/с, транспорт ${driving} м/с, порог эксперимента ${threshold} м. Геометрия между строками не меняется.\n\n| Задержка транспорта, с | Минимальная дистанция центров, м | Ближайший момент, с | Интервалы сближения, с |\n|---|---:|---:|---|\n${motion.map(r=>`| ${r.delay} | ${f(r.minDistance)} | ${f(r.closestAt)} | ${r.windows.map(w=>`${f(w.start)}–${f(w.end)}`).join('; ')||'нет'} |`).join('\n')}\n\nИсходный путь занят объектом: временная модель всё равно проводит участника по заданной траектории. Сначала нужно исправить геометрию. Движение центров, постоянные скорости, без торможения, реакции и габаритов. Порог эксперимента не является нормативом безопасности.\n\n## Что можно утверждать на защите\n\n- Система пересчитывает последствия перестановки по геометрии.\n- Замена одной проблемы другой видна по составу замечаний.\n- Изменение времени старта меняет сближение при тех же маршрутах.\n\nНельзя выводить процент снижения аварийности, экономию предприятия, точность AI или безопасность площадки из этих расчётов. Для этого нужны отдельные данные и проверка на реальном участке.\n\nИсходные сцены, найденный путь, основания замечаний и SHA-256 модулей находятся в \`measurements.json\`.\n`;
await mkdir(out,{recursive:true});
await writeFile(resolve(out,'measurements.json'),JSON.stringify(report,null,2)+'\n');
await writeFile(resolve(out,'MEASUREMENTS.md'),markdown);
console.log(markdown);
