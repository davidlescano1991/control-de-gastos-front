import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GraficoDiasRestantesAnual } from './grafico-dias-restantes-anual';

describe('GraficoDiasRestantesAnual', () => {
  let component: GraficoDiasRestantesAnual;
  let fixture: ComponentFixture<GraficoDiasRestantesAnual>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GraficoDiasRestantesAnual]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GraficoDiasRestantesAnual);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
