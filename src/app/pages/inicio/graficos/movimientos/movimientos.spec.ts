import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Movimientos } from './movimientos';

describe('Movimientos', () => {
  let component: Movimientos;
  let fixture: ComponentFixture<Movimientos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Movimientos]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Movimientos);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
