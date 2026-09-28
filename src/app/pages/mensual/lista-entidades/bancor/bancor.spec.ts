import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Bancor } from './bancor';

describe('Bancor', () => {
  let component: Bancor;
  let fixture: ComponentFixture<Bancor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Bancor]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Bancor);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
