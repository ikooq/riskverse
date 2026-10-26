import type {Finding,Scene} from './model';
import {compareScenes,comparisonTone} from './comparison';
import './comparison.css';

export default function SceneComparison({scene,baseline,onBaseline}:{scene:Scene;baseline:Scene;onBaseline:()=>void}){
 const result=compareScenes(scene,baseline);
 const groups:[string,Finding[],string][]=[['Устранены',result.resolved,'better'],['Появились',result.added,'worse'],['Остались',result.remaining,'neutral']];
 return <div id="scene-comparison" className="comparison comparison-details">
  <span className="eyebrow">СЦЕНАРИЙ / ДО И ПОСЛЕ</span>
  <h2>Изменения замечаний</h2>
  <p className={`comparison-verdict ${comparisonTone(result)}`}>{result.comparable?`Исходный: ${result.before.length} → текущий: ${result.after.length}. ${result.delta>0?'Замечаний стало больше':result.delta<0?'Замечаний стало меньше':'Количество не изменилось'}.`:'Условия различаются — итоговая оценка не сравнивается.'}</p>
  {result.reasons.length>0&&<ul className="comparison-reasons">{result.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul>}
  {!result.comparable&&<p>Ниже — различия результатов проверок, а не доказательство улучшения.</p>}
  <div className="comparison-groups">{groups.map(([label,findings,tone])=><details key={label} open={findings.length>0}>
   <summary className={tone}>{label}: {findings.length}</summary>
   {findings.length?<ul>{findings.map((f,index)=><li key={`${f.id}-${index}`}><b>{f.title}</b><span>{f.detail}</span></li>)}</ul>:<p>Нет замечаний в этой группе.</p>}
  </details>)}</div>
  <p>Длина пешеходного пути: {result.lengthBefore.toFixed(1)} → {result.lengthAfter.toFixed(1)} м.</p>
  {result.removedObjects.length>0&&<p className="comparison-removal">Удалены из модели: {result.removedObjects.join(', ')}. Подтвердите, что они убраны и на площадке.</p>}
  <p>Сравниваются геометрические проверки модели.</p>
  <button className="text-button" onClick={onBaseline}>Принять текущий за исходный</button>
 </div>;
}
