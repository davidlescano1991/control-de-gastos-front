import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListaMovimientos } from './lista-movimientos';

describe('ListaMovimientos', () => {
  let component: ListaMovimientos;
  let fixture: ComponentFixture<ListaMovimientos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListaMovimientos]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ListaMovimientos);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
