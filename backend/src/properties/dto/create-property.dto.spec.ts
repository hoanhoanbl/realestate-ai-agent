import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MAX_GALLERY_IMAGES, MAX_PANORAMA_ROOMS, UpdatePropertyDto } from './create-property.dto';
import type { Property } from '../entities/property.entity';
import { toListItem } from '../properties.service';

// Chạy: npm test (trong backend/)
const URL = 'https://example.com/phong-khach.jpg';

async function errorsFor(body: object): Promise<string[]> {
  const dto = plainToInstance(UpdatePropertyDto, body);
  const errors = await validate(dto, { whitelist: true });
  const messages = (list: typeof errors): string[] =>
    list.flatMap((e) => [...Object.values(e.constraints ?? {}), ...messages(e.children ?? [])]);
  return messages(errors);
}

describe('FE-31: phòng xem 360° của căn nhà', () => {
  it('nhận danh sách phòng hợp lệ và cắt khoảng trắng', async () => {
    const dto = plainToInstance(UpdatePropertyDto, { panoramas: [{ title: '  Phòng khách ', url: ` ${URL} ` }] });
    expect(await validate(dto)).toEqual([]);
    expect(dto.panoramas).toEqual([{ title: 'Phòng khách', url: URL }]);
  });

  it('mảng rỗng hợp lệ (quản lý xoá hết phòng)', async () => {
    expect(await errorsFor({ panoramas: [] })).toEqual([]);
  });

  it('không gửi panoramas thì không báo lỗi (sửa căn như cũ)', async () => {
    expect(await errorsFor({ name: 'Căn A' })).toEqual([]);
  });

  it('link không phải http/https thì báo lỗi', async () => {
    expect(await errorsFor({ panoramas: [{ title: 'Phòng ngủ', url: 'ftp://x/y.jpg' }] })).toContain(
      'Link ảnh 360° phải bắt đầu bằng http:// hoặc https://',
    );
  });

  it('thiếu tên phòng thì báo lỗi', async () => {
    expect(await errorsFor({ panoramas: [{ title: '   ', url: URL }] })).toContain('Phòng 360° cần có tên');
  });

  it(`quá ${MAX_PANORAMA_ROOMS} phòng thì báo lỗi`, async () => {
    const rooms = Array.from({ length: MAX_PANORAMA_ROOMS + 1 }, (_, i) => ({ title: `Phòng ${i + 1}`, url: URL }));
    expect(await errorsFor({ panoramas: rooms })).toContain(`Tối đa ${MAX_PANORAMA_ROOMS} phòng 360°`);
  });

  it('panoramas không phải mảng thì báo lỗi', async () => {
    expect((await errorsFor({ panoramas: { title: 'Phòng khách', url: URL } })).length).toBeGreaterThan(0);
  });
});

describe('FE-31: thông tin chi tiết căn nhà', () => {
  it('nhận đủ thông số, mã cố định và các danh sách hợp lệ', async () => {
    const body = {
      bedrooms: 3,
      bathrooms: 2,
      floors: 5,
      landArea: 63.6,
      floorArea: 120,
      roadWidth: 3.5,
      direction: 'DONG_NAM',
      legalStatus: 'SO_HONG',
      furnishing: 'FULL',
      occupancy: 'VACANT',
      images: [URL],
      features: ['Ban công'],
      furniture: ['Sofa'],
      nearby: [{ category: 'SCHOOL', name: 'Trường A', distance: '500 m' }],
    };
    expect(await errorsFor(body)).toEqual([]);
  });

  it('null = xoá thông số; chuỗi rỗng ở mã cố định cũng thành null', async () => {
    const dto = plainToInstance(UpdatePropertyDto, { bedrooms: null, direction: '', legalStatus: '  ' });
    expect(await validate(dto)).toEqual([]);
    expect(dto.direction).toBeNull();
    expect(dto.legalStatus).toBeNull();
  });

  it('danh sách tiện ích: cắt khoảng trắng, bỏ dòng trống và dòng trùng', async () => {
    const dto = plainToInstance(UpdatePropertyDto, { features: [' Ban công ', '', 'Ban công', 'Sân vườn'] });
    expect(await validate(dto)).toEqual([]);
    expect(dto.features).toEqual(['Ban công', 'Sân vườn']);
  });

  it('báo lỗi mã không hợp lệ, số âm, số lẻ phòng ngủ', async () => {
    expect((await errorsFor({ legalStatus: 'SO_XANH' })).length).toBeGreaterThan(0);
    expect((await errorsFor({ furnishing: 'DEP' })).length).toBeGreaterThan(0);
    expect((await errorsFor({ landArea: -5 })).length).toBeGreaterThan(0);
    expect((await errorsFor({ bedrooms: 2.5 })).length).toBeGreaterThan(0);
  });

  it('báo lỗi link ảnh thêm sai và quá số ảnh cho phép', async () => {
    expect(await errorsFor({ images: ['anh.jpg'] })).toContain('Link ảnh phải bắt đầu bằng http:// hoặc https://');
    const many = Array.from({ length: MAX_GALLERY_IMAGES + 1 }, (_, i) => `${URL}?${i}`);
    expect(await errorsFor({ images: many })).toContain(`Tối đa ${MAX_GALLERY_IMAGES} ảnh thêm`);
  });

  it('dịch vụ xung quanh: báo lỗi nhóm lạ và thiếu tên', async () => {
    expect(await errorsFor({ nearby: [{ category: 'CASINO', name: 'A', distance: '1 km' }] })).toContain(
      'Nhóm dịch vụ xung quanh không hợp lệ',
    );
    expect(await errorsFor({ nearby: [{ category: 'PARK', name: ' ', distance: '1 km' }] })).toContain(
      'Dịch vụ xung quanh cần có tên',
    );
  });
});

describe('FE-31: danh sách nhà bản gọn', () => {
  it('bỏ link ảnh thêm và link 360°, trả số lượng', () => {
    const p = {
      id: 1,
      name: 'Căn A',
      images: [URL, URL],
      panoramas: [{ title: 'Phòng khách', url: URL }],
      features: ['Ban công'],
    } as unknown as Property;
    const item = toListItem(p);
    expect(item).not.toHaveProperty('images');
    expect(item).not.toHaveProperty('panoramas');
    expect(item).toMatchObject({ imageCount: 2, panoramaCount: 1, features: ['Ban công'] });
    expect(toListItem({ id: 2, images: null, panoramas: null } as unknown as Property)).toMatchObject({
      imageCount: 0,
      panoramaCount: 0,
    });
  });
});
