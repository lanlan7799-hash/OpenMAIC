import { describe, expect, it } from 'vitest';

import { parseJsonResponse } from '@/lib/generation/json-repair';

describe('json-repair targeted fixes', () => {
  it('repairs quoted key-value fragments such as "height: 76"', () => {
    const raw = `{
  "background": {
    "type": "solid",
    "color": "#ffffff"
  },
  "elements": [
    {
      "id": "code_text",
      "type": "text",
      "left": 80,
      "top": 420,
      "width": 840,
      "height: 76",
      "content": "<p style=\\"font-size: 22px;\\">age = 25</p>",
      "defaultFontName": "",
      "defaultColor": "#333333"
    }
  ]
}`;

    const parsed = parseJsonResponse<{
      elements: Array<{ height: number; content: string }>;
    }>(raw);

    expect(parsed).not.toBeNull();
    expect(parsed?.elements[0]?.height).toBe(76);
    expect(parsed?.elements[0]?.content).toContain('age = 25');
  });

  it('repairs boolean property fragments without touching valid string values', () => {
    const raw = `{
  "elements": [
    {
      "id": "shape_1",
      "fixedRatio: false",
      "height: 58",
      "content": "<p>literal text: height: 58</p>"
    }
  ]
}`;

    const parsed = parseJsonResponse<{
      elements: Array<{ fixedRatio: boolean; height: number; content: string }>;
    }>(raw);

    expect(parsed).not.toBeNull();
    expect(parsed?.elements[0]?.fixedRatio).toBe(false);
    expect(parsed?.elements[0]?.height).toBe(58);
    expect(parsed?.elements[0]?.content).toBe('<p>literal text: height: 58</p>');
  });

  it('repairs unescaped quotes inside Chinese teacher action text', () => {
    const raw = `{
  "actions": [
    {
      "id": "intro",
      "type": "speech",
      "content": "同学们好！今天我们来玩一个有趣的游戏——数方格！在生活中，我们要测量桌面、黑板的大小，就需要用到"面积"这个概念。面积就是物体表面的大小。",
      "label": "介绍活动"
    }
  ]
}`;

    const parsed = parseJsonResponse<{
      actions: Array<{ content: string }>;
    }>(raw);

    expect(parsed).not.toBeNull();
    expect(parsed?.actions[0]?.content).toContain('"面积"这个概念');
  });
});
