import { describe, it, expect } from 'vitest';
import { parseDetail } from '../lib/parse-detail';

const HTML = `
<div>
  <ods-map ratio="ods-ratio-1-1 mapboxgl-map"
    :state="{&quot;zoom&quot;:15,&quot;longitude&quot;:&quot;10.862727820137&quot;,&quot;latitude&quot;:&quot;59.924773978523&quot;}"
    :points="[{&quot;longitude&quot;:&quot;10.862727820137&quot;,&quot;latitude&quot;:&quot;59.924773978523&quot;,&quot;openPopup&quot;:true}]">
  </ods-map>
  <dl class="ods-contactbox__group">
    <dt class="ods-contactbox__label">Besøksadresse</dt>
    <dd class="ods-contactbox__value"> Dr. Dedichens vei 18, 0675 Oslo </dd>
  </dl>
</div>`;

describe('parseDetail', () => {
  it('extracts coordinates', () => {
    const d = parseDetail(HTML);
    expect(d.lat).toBeCloseTo(59.924773978523, 6);
    expect(d.lon).toBeCloseTo(10.862727820137, 6);
  });
  it('extracts visiting address', () => {
    expect(parseDetail(HTML).address).toBe('Dr. Dedichens vei 18, 0675 Oslo');
  });
  it('returns nulls when data is absent', () => {
    const d = parseDetail('<div>nothing here</div>');
    expect(d.lat).toBeNull(); expect(d.lon).toBeNull(); expect(d.address).toBeNull();
  });
});
