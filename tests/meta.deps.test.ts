import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

describe('의존성 계약', () => {
  it('dependencies는 react와 react-dom 뿐이다', () => {
    expect(Object.keys(packageJson.dependencies).sort()).toEqual(['react', 'react-dom']);
    expect(packageJson.dependencies).toEqual({ react: '18.3.1', 'react-dom': '18.3.1' });
    const manifest=readFileSync('package.json','utf8');
    for(const name of ['redux','zustand','mobx','jotai','recoil','styled-components','emotion','mui','antd','tailwindcss','chakra']) expect(manifest).not.toContain(name);
  });

  it('devDependencies 버전이 설치본과 일치한다', () => {
    for (const [name, expected] of Object.entries(packageJson.devDependencies)) {
      const installed = JSON.parse(readFileSync(`node_modules/${name}/package.json`, 'utf8')) as { version: string };
      expect(installed.version, name).toBe(expected);
    }
  });

  it('외부 폰트·CDN 링크가 없다', () => {
    const source = [readFileSync('index.html', 'utf8'), readFileSync('src/styles.css', 'utf8'),readFileSync('src/App.tsx','utf8'),readFileSync('src/main.tsx','utf8')].join('\n');
    expect(source).not.toMatch(/https?:\/\//i);
    expect(source).not.toMatch(/@import\s+url/i);
    expect(source).not.toContain('fonts.googleapis');
  });
});
