import {useEffect,useMemo,useState} from 'react';
import {ArrowRight,Check,Eye,Footprints,TriangleAlert} from 'lucide-react';
import {analyze,suggestPlacements,type Scene} from './model';
import {compareScenes} from './comparison';
import Plan from './Plan';
import './demo.css';

export default function DemoExperiment({scene,baseline,onApply}:{scene:Scene;baseline:Scene;onApply:(scene:Scene)=>void}){
 const findings=useMemo(()=>analyze(scene),[scene]);
 const candidates=scene.items.filter(item=>findings.some(f=>(f.itemId===item.id||f.otherItemId===item.id)&&['blocked','vehicleBlocked','overlap','visibility'].includes(f.type)));
 const [selectedId,setSelectedId]=useState(''),[preview,setPreview]=useState<ReturnType<typeof suggestPlacements>[number]|null>(null);
 const selectedItem=candidates.find(item=>item.id===selectedId)??candidates[0];
 const suggestions=useMemo(()=>selectedItem?suggestPlacements(scene,selectedItem.id):[],[scene,selectedItem]);
 useEffect(()=>setPreview(null),[scene,selectedItem?.id]);
 const alternatives=suggestions.map((suggestion,index)=>{
  const item=selectedItem!;
  const remaining=suggestion.findings.filter(f=>(f.itemId===item.id||f.otherItemId===item.id)&&['blocked','vehicleBlocked','overlap','visibility'].includes(f.type));
  return {suggestion,index,remaining,selected:preview?.x===suggestion.x&&preview?.y===suggestion.y};
 });
 const difference=compareScenes(scene,baseline);
 if(!selectedItem)return null;
 const selectedIssues=findings.filter(f=>(f.itemId===selectedItem.id||f.otherItemId===selectedItem.id)&&['blocked','vehicleBlocked','overlap','visibility'].includes(f.type));
 const newVisibility=difference.added.some(f=>f.type==='visibility'&&(f.itemId===selectedItem.id||f.otherItemId===selectedItem.id));
 const cleared=selectedIssues.length>0&&suggestions.some(option=>option.score<selectedIssues.reduce((sum,f)=>sum+(f.severity==='high'?100:10),0));
 const previewItem=preview&&selectedItem?{...selectedItem,x:preview.x,y:preview.y}:null;
 const previewScene=previewItem?{...scene,items:scene.items.map(item=>item.id===previewItem.id?previewItem:item)}:scene;
 const previewFindings=preview?preview.findings:findings;
 const previewComparison=preview?compareScenes(previewScene,baseline):null;
 return <section className="demo-experiment" aria-label="Проверка предложений по планировке">
  <div className="experiment-heading"><div><span className="eyebrow">ПЕРЕПЛАНИРОВКА · АВТОМАТИЧЕСКИЙ ГЕОМЕТРИЧЕСКИЙ ПОИСК</span><h2>Где разместить объект?</h2></div><label className="experiment-object">Объект <select aria-label="Объект для перемещения" value={selectedItem.id} onChange={e=>setSelectedId(e.target.value)}>{candidates.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
  <p className="experiment-intro">Ищем свободные позиции по всей площадке, отбрасываем наложения и пересечения с маршрутами, затем пересчитываем замечания. Выберите вариант, чтобы применить его к плану.</p>
  <div className="experiment-layout"><div className="experiment-plan"><span>{preview?'ПРЕДПРОСМОТР · ':'ТЕКУЩАЯ ГЕОМЕТРИЯ · '}{scene.width} × {scene.height} м</span><Plan readOnly scene={scene} findings={previewFindings} selected={selectedItem.id} previewItem={previewItem} onSelect={()=>{}} onMove={()=>{}} routeEdit={false} onRoute={()=>{}}/><div className="experiment-map-key"><span>● Пешеходы</span><span>● Транспорт</span><span>◌ Замечания</span></div></div><div className="experiment-choices">{alternatives.length?alternatives.map(({suggestion,index,remaining,selected})=><button key={`${suggestion.x}-${suggestion.y}`} className={`experiment-choice ${selected?'is-selected':''}`} aria-label={`Предпросмотр варианта ${index+1}, X ${suggestion.x}, Y ${suggestion.y}`} aria-pressed={selected} onClick={()=>setPreview(suggestion)}>
   <span className="experiment-step">0{index+1}<ArrowRight size={14}/></span><b>Свободное место {index+1}</b><small>Перемещение на {suggestion.distance.toFixed(1)} м · X {suggestion.x.toFixed(1)}, Y {suggestion.y.toFixed(1)}</small>
   <span className="experiment-check is-clear"><Footprints size={13}/>{remaining.length?`Остаётся замечаний об объекте: ${remaining.length}`:'Проверки проходов пройдены'}</span>
   <span className={`experiment-check ${remaining.some(f=>f.type==='visibility')?'has-conflict':'is-clear'}`}><Eye size={13}/>{remaining.some(f=>f.type==='visibility')?'Проверьте ограничение обзора':'Новая слепая зона не выявлена'}</span>
  </button>):<div className="experiment-insight" role="status"><TriangleAlert size={20}/><p><b>Свободное место не найдено.</b> Для выбранного объекта нельзя предложить допустимую позицию без конфликта с границами, проходами или другими объектами.</p></div>}</div></div>
  {preview&&<div className="experiment-preview-actions" role="group" aria-label="Подтверждение перемещения"><span>{previewComparison?.comparable?`Предпросмотр: ${previewFindings.length} замечаний · ${previewComparison.resolved.length} устранено · ${previewComparison.added.length} появится`:'Проверьте призрачный объект на плане; условия сравнения с исходным сценарием отличаются.'}</span><button className="text-button" onClick={()=>setPreview(null)}>Отменить</button><button className="button lime" onClick={()=>onApply(previewScene)}>Применить выбранное место</button></div>}
  <div className={`experiment-insight ${newVisibility?'tradeoff':''}`} role="status">{cleared?<Check size={20}/>:newVisibility?<TriangleAlert size={20}/>:<Eye size={20}/>}<p>{newVisibility?<><b>Перенос создал возможное ограничение обзора.</b> Проверьте линию на плане и сравните состав замечаний.</>:cleared?<><b>Предложение убирает выбранное замечание.</b> Все проверки после перемещения пересчитываются для текущей сцены.</>:<><b>Предложения меняют только координаты объекта.</b> Маршруты и размеры подтверждённой геометрии сохраняются.</>}</p></div>
  <small className="experiment-assumption">Это геометрические подсказки модели, а не заключение о безопасности. Коридор транспорта принят 1 м; размеры, маршруты и обзор нужно проверить на реальном участке.</small>
 </section>;
}
