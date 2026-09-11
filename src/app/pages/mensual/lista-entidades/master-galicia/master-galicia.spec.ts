import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MasterGalicia } from './master-galicia';

describe('MasterGalicia', () => {
  let component: MasterGalicia;
  let fixture: ComponentFixture<MasterGalicia>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MasterGalicia]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MasterGalicia);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
