import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MovimientosUsd } from './movimientos-usd';

describe('MovimientosUsd', () => {
  let component: MovimientosUsd;
  let fixture: ComponentFixture<MovimientosUsd>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MovimientosUsd]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MovimientosUsd);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
