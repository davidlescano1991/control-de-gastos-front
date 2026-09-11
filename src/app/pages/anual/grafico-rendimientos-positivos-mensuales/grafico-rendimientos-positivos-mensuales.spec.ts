import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GraficoRendimientosPositivosMensuales } from './grafico-rendimientos-positivos-mensuales';

describe('GraficoRendimientosPositivosMensuales', () => {
  let component: GraficoRendimientosPositivosMensuales;
  let fixture: ComponentFixture<GraficoRendimientosPositivosMensuales>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GraficoRendimientosPositivosMensuales]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GraficoRendimientosPositivosMensuales);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
