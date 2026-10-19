# DH Face Recognition API

Separate FastAPI service for employee face enrollment and verification. It uses DeepFace with the ArcFace model. Photos are not stored. Face vectors are saved in SQL Server database `MobileAppDB`, table `dbo.FaceVector`, so a published API uses the same cloud database as attendance.

Python 3.10 or newer is required.

## Run

ZKBio sets the machine variable `PYTHONHOME` to `C:\ZKBioWDMS\Python311`. That makes every Python, including 3.13, load a broken standard library (`SRE module mismatch`). Clear it in the same window before any Python command. Do not delete the machine variable; ZKBio needs it.

```powershell
cd "D:\DH Mobile App\face-recognition-api"
Remove-Item Env:\PYTHONHOME
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
copy .env.example .env
.\run.ps1
```

`run.ps1` clears `PYTHONHOME` and starts the API. Activating `.venv` alone still fails while that variable is set.

## Docker

Build the image on the server. The image is about 1 GB because it includes DeepFace, so uploading it from a PC to Docker Hub is slow. The source folder is small. Copy that to the server and build there.

On the server, SQL Server is already published on port 1433. The face container reaches it through the host gateway. Pass the SQL settings when the container is created. Do not bake the password into the image.

The first start downloads ArcFace weights. Open `http://127.0.0.1:8000/docs` to try the endpoints.

Set `FACE_API_KEY` in `.env` to the same value as `FACE_API_KEY` in the mobile app (`dev-face-key` by default).

## Endpoints

All routes except `/health` need the header `X-API-Key`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Service and model status |
| GET | `/api/v1/faces/{company_id}/{employee_id}` | Enrollment status |
| POST | `/api/v1/faces/enroll` | Save a face for one employee |
| POST | `/api/v1/faces/verify` | Check a photo against one employee |
| POST | `/api/v1/faces/recognize` | Find the closest enrolled employee in a company |
| POST | `/api/v1/attendance/mark` | Recognize a face and insert today's attendance |
| GET | `/api/v1/attendance` | List attendance rows for a company |
| DELETE | `/api/v1/faces/{company_id}/{employee_id}` | Remove an enrollment |

Attendance is stored in SQL Server database `MobileAppDB`, table `dbo.Attendance`. The shape follows `HCM.Attendance`, with `EESerialID`, confidence, and distance added for face check-in. One row per company, employee, and date. The first matching face sets `TimeIn`. A later face the same day sets `TimeOut`. A second scan within one minute of check-in does not check the employee out. Connection settings belong in `.env`.

`enroll`, `verify`, and `recognize` take a multipart photo field named `image`.

## Mobile app

On a real phone, `FACE_API_URL` in `dh-mobile-app/src/config/api.ts` must be this computer's LAN address, for example `http://192.168.1.207:8000`. The phone and this PC need to be on the same network, and Windows Firewall must allow port 8000.
