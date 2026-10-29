import { useSearchParams } from 'react-router-dom';
import { EXERCISES } from '@korvex/core';
import { ExerciseDemo } from '../../components/demo/ExerciseDemo';

/** Só no modo de desenvolvimento: início e fim de cada demonstração lado a lado (ou animadas com ?anim=1). */
export function DemoGallery() {
  const [params] = useSearchParams();
  const anim = params.has('anim');
  const only = params.get('ids')?.split(',');
  const list = only ? EXERCISES.filter((e) => only.includes(e.id)) : EXERCISES;
  return (
    <div className={anim ? 'grid grid-cols-3 gap-3 p-3' : 'grid grid-cols-2 gap-4 p-4 md:grid-cols-3'}>
      {list.map((ex) => (
        <div key={ex.id} data-ex={ex.id}>
          <p className="mb-1 text-sm font-semibold">{ex.name}</p>
          {anim ? (
            <ExerciseDemo exerciseId={ex.id} name={ex.name} />
          ) : (
            <div className="grid grid-cols-2 gap-1">
              <ExerciseDemo exerciseId={ex.id} name={ex.name} phase={0} />
              <ExerciseDemo exerciseId={ex.id} name={ex.name} phase={0.43} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
