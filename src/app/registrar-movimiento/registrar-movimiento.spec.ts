import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RegistrarMovimiento } from './registrar-movimiento';

describe('RegistrarMovimiento', () => {
  let component: RegistrarMovimiento;
  let fixture: ComponentFixture<RegistrarMovimiento>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegistrarMovimiento]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RegistrarMovimiento);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
