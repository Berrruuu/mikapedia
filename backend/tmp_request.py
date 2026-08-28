import urllib.request
import json

url = 'http://127.0.0.1:8002/api/attendance/schedules/'
headers = {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzg0ODAzMTg4LCJpYXQiOjE3ODQ3OTk1ODgsImp0aSI6ImU3YWIzNTkwM2IwYjQ2OWM4MmQ2N2ZiNTlmM2VkODQ0IiwidXNlcl9pZCI6ImJlZmUwMGIzLTIwNTktNDE0ZC05MDY2LWIzZWQ1MmJjOWEwYyJ9.6KAov6DlpMsvYA-tm1yJAcruseKpYjO_yCYOo67dDqE',
    'Content-Type': 'application/json',
}
req = urllib.request.Request(url, headers=headers, method='GET')
try:
    with urllib.request.urlopen(req, timeout=20) as resp:
        body = resp.read().decode('utf-8')
        print('status', resp.status)
        print('body', body)
except urllib.error.HTTPError as e:
    print('status', e.code)
    try:
        print('body', e.read().decode('utf-8'))
    except Exception as err:
        print('body read failed', err)
except Exception as e:
    print('exception', type(e).__name__, e)
