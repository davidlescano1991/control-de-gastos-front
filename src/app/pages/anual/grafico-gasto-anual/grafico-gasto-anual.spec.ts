import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GraficoGastoAnual } from './grafico-gasto-anual';

describe('GraficoGastoAnual', () => {
  let component: GraficoGastoAnual;
  let fixture: ComponentFixture<GraficoGastoAnual>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GraficoGastoAnual]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GraficoGastoAnual);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
