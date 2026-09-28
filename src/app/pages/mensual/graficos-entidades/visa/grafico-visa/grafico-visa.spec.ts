import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GraficoVisa } from './grafico-visa';

describe('GraficoVisa', () => {
  let component: GraficoVisa;
  let fixture: ComponentFixture<GraficoVisa>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GraficoVisa]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GraficoVisa);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
