import http from 'k6/http';
import { check } from 'k6';

export let options = {
  vus: 20,          // 20 users
  duration: '10s',  // for 10 seconds
};

export default function () {
  const payload = JSON.stringify({
    email: "qais@a.com",
    password: "111111"
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  let res = http.post('http://revchat.onrender.com/api/login', payload, params);

  check(res, {
    'status is 200': (r) => r.status === 200,
  });
}