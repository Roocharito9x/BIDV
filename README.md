# BIDV Training

Ứng dụng luyện thi và học tập kiến thức dành cho BIDV, triển khai bằng GitHub Pages.

## Chức năng

- Thư viện nhiều bộ đề.
- Danh sách câu hỏi và tìm kiếm.
- Luyện thi ngẫu nhiên hoặc theo thứ tự.
- Lưu câu sai và tiến độ trên thiết bị.
- Flashcard từ bộ dữ liệu có sẵn hoặc tự sinh từ câu hỏi Excel.
- Nhập bộ đề `.xlsx`/`.xls` và kiểm tra dữ liệu trước khi lưu.

## Chạy tại máy

Ứng dụng cần được phục vụ qua HTTP để tải dữ liệu JSON:

```bash
python3 -m http.server 8080
```

Sau đó mở `http://localhost:8080/Quiz_testing.html`.

## GitHub Pages

Thiết lập Pages với nhánh `main`, thư mục `/ (root)`. Địa chỉ dự kiến:

`https://roocharito9x.github.io/BIDV/Quiz_testing.html`
