import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GraficoSaldoAnual } from './grafico-saldo-anual';

describe('GraficoSaldoAnual', () => {
  let component: GraficoSaldoAnual;
  let fixture: ComponentFixture<GraficoSaldoAnual>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GraficoSaldoAnual]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GraficoSaldoAnual);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
