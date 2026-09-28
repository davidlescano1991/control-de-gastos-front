import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Naranja } from './naranja';

describe('Naranja', () => {
  let component: Naranja;
  let fixture: ComponentFixture<Naranja>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Naranja]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Naranja);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
