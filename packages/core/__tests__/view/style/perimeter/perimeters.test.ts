/*
Copyright 2026-present The maxGraph project Contributors

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { describe, expect, test } from '@jest/globals';
import { type CellState, Perimeter, Point, Rectangle } from '../../../../src';
import type { DirectionValue, PerimeterFunction } from '../../../../src/types';

const { HexagonPerimeter, RhombusPerimeter, TrianglePerimeter } = Perimeter;

// Test double (stub): the perimeter functions only read `vertex.style.direction`,
// so there is no need to build a real CellState with a graph, a view and a cell.
const stubVertex = (direction?: DirectionValue): CellState =>
  ({ style: { direction } }) as unknown as CellState;

const p = (x: number, y: number): Point => new Point(x, y);

// Values chosen so that every Math.floor(0.25 * w) and similar in HexagonPerimeter is exact
const bounds = new Rectangle(0, 0, 200, 100);
const center = p(100, 50);

const expectPoint = (actual: Point | null, expected: Point): void => {
  expect(actual).not.toBeNull();
  expect(actual!.x).toBeCloseTo(expected.x, 6);
  expect(actual!.y).toBeCloseTo(expected.y, 6);
};

const distanceToSegment = (pt: Point, a: Point, b: Point): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(
    0,
    Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / (dx * dx + dy * dy))
  );
  return Math.hypot(pt.x - (a.x + t * dx), pt.y - (a.y + t * dy));
};

const distanceToBorder = (pt: Point, polygon: Point[]): number =>
  Math.min(
    ...polygon.map((a, i) => distanceToSegment(pt, a, polygon[(i + 1) % polygon.length]))
  );

const distanceToLine = (pt: Point, from: Point, to: Point): number =>
  Math.abs((to.x - from.x) * (pt.y - from.y) - (to.y - from.y) * (pt.x - from.x)) /
  Math.hypot(to.x - from.x, to.y - from.y);

describe('the perimeter point is on the border of the shape, in the direction of the next point', () => {
  // 36 points on a large circle around the shape, one every 10 degrees
  const pointsAround = Array.from({ length: 36 }, (_, i) => {
    const angle = (i * 10 * Math.PI) / 180;
    return p(center.x + 500 * Math.cos(angle), center.y - 500 * Math.sin(angle));
  });

  const horizontalHexagon = [
    p(50, 0),
    p(150, 0),
    p(200, 50),
    p(150, 100),
    p(50, 100),
    p(0, 50),
  ];
  const verticalHexagon = [
    p(100, 0),
    p(200, 25),
    p(200, 75),
    p(100, 100),
    p(0, 75),
    p(0, 25),
  ];

  test.each<[string, PerimeterFunction, CellState, Point[]]>([
    [
      'rhombus',
      RhombusPerimeter,
      stubVertex(),
      [p(100, 0), p(200, 50), p(100, 100), p(0, 50)],
    ],
    [
      'triangle east (default)',
      TrianglePerimeter,
      stubVertex(),
      [p(0, 0), p(200, 50), p(0, 100)],
    ],
    [
      'triangle west',
      TrianglePerimeter,
      stubVertex('west'),
      [p(200, 0), p(0, 50), p(200, 100)],
    ],
    [
      'triangle north',
      TrianglePerimeter,
      stubVertex('north'),
      [p(0, 100), p(100, 0), p(200, 100)],
    ],
    [
      'triangle south',
      TrianglePerimeter,
      stubVertex('south'),
      [p(0, 0), p(100, 100), p(200, 0)],
    ],
    ['hexagon east (default)', HexagonPerimeter, stubVertex(), horizontalHexagon],
    ['hexagon north', HexagonPerimeter, stubVertex('north'), verticalHexagon],
    ['hexagon south', HexagonPerimeter, stubVertex('south'), verticalHexagon],
  ])('%s', (_name, perimeter, vertex, polygon) => {
    for (const next of pointsAround) {
      const result = perimeter(bounds, vertex, next, false);

      expect(result).not.toBeNull();
      expect(distanceToBorder(result!, polygon)).toBeCloseTo(0, 6);
      expect(distanceToLine(result!, center, next)).toBeCloseTo(0, 6);
    }
  });
});

describe('RhombusPerimeter', () => {
  test.each([
    ['above', p(100, -300), p(100, 0)],
    ['below', p(100, 400), p(100, 100)],
    ['left', p(-300, 50), p(0, 50)],
    ['right', p(500, 50), p(200, 50)],
  ])(
    'returns the corner when the next point is exactly %s the center',
    (_name, next, expected) => {
      expectPoint(RhombusPerimeter(bounds, stubVertex(), next, false), expected);
    }
  );

  test('projects vertically on the border when orthogonal', () => {
    expectPoint(RhombusPerimeter(bounds, stubVertex(), p(60, -100), true), p(60, 20));
  });

  test('projects horizontally on the border when orthogonal and the next point is beside the shape', () => {
    expectPoint(RhombusPerimeter(bounds, stubVertex(), p(-100, 30), true), p(40, 30));
  });

  test('returns null when the next point is inside the shape', () => {
    expect(RhombusPerimeter(bounds, stubVertex(), p(110, 55), false)).toBeNull();
  });
});

describe('TrianglePerimeter', () => {
  test.each<[DirectionValue | undefined, Point, Point]>([
    [undefined, p(500, 50), p(200, 50)],
    ['west', p(-300, 50), p(0, 50)],
    ['north', p(100, -300), p(100, 0)],
    ['south', p(100, 400), p(100, 100)],
  ])(
    'direction %s: returns the apex when the next point is in front of it',
    (direction, next, expected) => {
      expectPoint(
        TrianglePerimeter(bounds, stubVertex(direction), next, false),
        expected
      );
    }
  );

  test.each<[DirectionValue | undefined, Point, Point]>([
    [undefined, p(-300, 50), p(0, 50)],
    ['west', p(500, 50), p(200, 50)],
    ['north', p(100, 400), p(100, 100)],
    ['south', p(100, -300), p(100, 0)],
  ])(
    'direction %s: returns the middle of the base when the next point is behind it',
    (direction, next, expected) => {
      expectPoint(
        TrianglePerimeter(bounds, stubVertex(direction), next, false),
        expected
      );
    }
  );

  test.each<[string, DirectionValue | undefined, Point, Point]>([
    ['on the base, horizontal triangle', undefined, p(-300, 20), p(0, 20)],
    ['on the base, vertical triangle', 'north', p(40, 400), p(40, 100)],
    ['on a side', undefined, p(150, -300), p(150, 37.5)],
  ])(
    'projects the next point when orthogonal: %s',
    (_name, direction, next, expected) => {
      expectPoint(TrianglePerimeter(bounds, stubVertex(direction), next, true), expected);
    }
  );

  test('returns the center when the next point is inside the shape', () => {
    expectPoint(TrianglePerimeter(bounds, stubVertex(), p(140, 48), false), center);
  });
});

describe('HexagonPerimeter', () => {
  test.each<[DirectionValue | undefined, Point, Point]>([
    [undefined, p(600, 50), p(200, 50)],
    [undefined, p(-400, 50), p(0, 50)],
    [undefined, p(600, -450), p(150, 0)],
    [undefined, p(-400, -450), p(50, 0)],
    [undefined, p(600, 550), p(150, 100)],
    [undefined, p(-400, 550), p(50, 100)],
    ['north', p(100, -400), p(100, 0)],
    ['north', p(100, 500), p(100, 100)],
    ['north', p(500, -50), p(200, 25)],
    ['north', p(-300, -50), p(0, 25)],
    ['north', p(500, 150), p(200, 75)],
    ['north', p(-300, 150), p(0, 75)],
  ])(
    'direction %s: returns the corner the next point %o is aligned with',
    (direction, next, expected) => {
      expectPoint(HexagonPerimeter(bounds, stubVertex(direction), next, false), expected);
    }
  );

  test.each<[string, DirectionValue | undefined, Point, Point]>([
    ['above a horizontal hexagon', undefined, p(60, -300), p(60, 0)],
    ['below a horizontal hexagon', undefined, p(80, 400), p(80, 100)],
    ['beside a horizontal hexagon', undefined, p(-300, 40), p(10, 40)],
    ['beside a vertical hexagon', 'north', p(-300, 40), p(0, 40)],
    ['above a vertical hexagon', 'north', p(130, -300), p(130, 7.5)],
  ])(
    'projects the next point when orthogonal: %s',
    (_name, direction, next, expected) => {
      expectPoint(HexagonPerimeter(bounds, stubVertex(direction), next, true), expected);
    }
  );

  test('ignores orthogonal when the next point is in a corner quadrant', () => {
    const next = p(-300, -300);
    expect(HexagonPerimeter(bounds, stubVertex(), next, true)).toEqual(
      HexagonPerimeter(bounds, stubVertex(), next, false)
    );
  });

  test('orthogonal: next point at the middle of the top side stays where it is', () => {
    expectPoint(HexagonPerimeter(bounds, stubVertex(), p(100, 0), true), p(100, 0));
  });

  // Bug found while writing these tests, inherited from mxGraph 4.2.2 (mxPerimeter.js).
  // In the "py === y + h" branch, the second condition is `py > cy` instead of `px > cx`. It is always true
  // there, so the middle of the bottom side jumps to the bottom right corner, while the symmetric point on
  // the top side (previous test) stays where it is.
  // `test.failing` passes as long as the bug exists, and will fail once it is fixed.
  test.failing(
    'orthogonal: next point at the middle of the bottom side stays where it is',
    () => {
      expectPoint(HexagonPerimeter(bounds, stubVertex(), p(100, 100), true), p(100, 100));
    }
  );
});
