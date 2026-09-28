import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListaSaldoDiario } from './lista-saldo-diario';

describe('ListaSaldoDiario', () => {
  let component: ListaSaldoDiario;
  let fixture: ComponentFixture<ListaSaldoDiario>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListaSaldoDiario]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ListaSaldoDiario);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
