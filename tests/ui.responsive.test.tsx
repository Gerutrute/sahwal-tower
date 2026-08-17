// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('반응형과 비주얼 계약',()=>{
  const css=readFileSync('src/styles.css','utf8');
  it('380px 기준 가로 오버플로를 유발하는 스타일이 없다',()=>{ const board=readFileSync('src/components/BoardSvg.tsx','utf8');const html=readFileSync('index.html','utf8');expect(css).toMatch(/max-width:\s*430px/);expect(css).toMatch(/overflow-x:\s*hidden/);expect(css).not.toMatch(/min-width:\s*(?:38[1-9]|3[9-9]\d|[4-9]\d\d)px/);expect(board).not.toMatch(/<svg[^>]+(?:width|height)=/);expect(html).toMatch(/name="viewport" content="width=device-width, initial-scale=1/); });
  it('앱 컨테이너는 최대폭 430px 중앙 정렬이다',()=>{ expect(css).toMatch(/max-width:\s*430px/); expect(css).toMatch(/margin(?:-inline)?:\s*(?:0\s+)?auto/); });
  it('모든 조작 요소가 터치 가능한 button이며 최소 크기를 만족한다',()=>{ const board=readFileSync('src/components/BoardSvg.tsx','utf8'); expect(css).toMatch(/min-height:\s*44px/); expect(css).toMatch(/touch-action:\s*manipulation/); expect(css).toMatch(/flex-wrap:\s*wrap/); expect(board).toContain('role="button"'); expect(board).toContain('tabIndex='); expect(board).toContain('onKeyDown='); });
  it('색 토큰이 명세 값과 정확히 일치한다',()=>{ for(const color of ['#16151c','#211f29','#e3d3ae','#6b5a3a','#c0392b','#8e2a1f','#d4a938','#eae6da','#8f8a7d']) expect(css).toContain(color); });
  it('reduced-motion에서 모든 애니메이션이 비활성화된다',()=>{ expect(css).toContain('stone-pop{animation:stone-pop .18s');expect(css).toMatch(/prefers-reduced-motion:\s*reduce/); expect(css).toMatch(/animation:\s*none/); expect(css).toMatch(/transition:\s*none/); });
  it('숫자는 tabular 정렬을 사용한다',()=>expect(css).toContain('tabular-nums'));
  it('빈 교차점 터치 영역은 반칸 반지름이며 투명하다',()=>{ const board=readFileSync('src/components/BoardSvg.tsx','utf8'); expect(board).toContain('r={STEP/2}'); expect(board).toContain('fill="transparent"'); });
  it('붉은색과 warm glow의 사용 범위가 제한된다',()=>{ expect(css.match(/drop-shadow/g)).toHaveLength(1); expect(css).toMatch(/\.board-wrap\{filter:drop-shadow/);expect(css).not.toMatch(/box-shadow:[^}]*var\(--(?:ju|ju-deep)\)/);expect(css).toContain('--ju:#c0392b'); });
});
