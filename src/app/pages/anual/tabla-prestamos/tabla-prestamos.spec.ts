import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TablaPrestamos } from './tabla-prestamos';

describe('TablaPrestamos', () => {
  let component: TablaPrestamos;
  let fixture: ComponentFixture<TablaPrestamos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TablaPrestamos]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TablaPrestamos);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
