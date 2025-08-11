using UnityEngine;

public class PlayerController : MonoBehaviour
{
    [Header("Move")]
    public float moveSpeed = 6f;

    [Header("Shooting")]
    public Transform firePoint; // فارغ على مقدّمة اللاعب
    public GameObject bulletPrefab;
    public float bulletSpeed = 14f;
    public float fireRate = 0.15f;
    float _nextFire;

    Rigidbody2D _rb;
    Vector2 _move;
    Camera _cam;

    void Awake()
    {
        _rb = GetComponent<Rigidbody2D>();
        _cam = Camera.main;
    }

    void Update()
    {
        // حركة WASD/أزرار الأسهم
        _move.x = Input.GetAxisRaw("Horizontal");
        _move.y = Input.GetAxisRaw("Vertical");
        _move = _move.normalized;

        // توجّه الماوس
        Vector3 mouseWorld = _cam.ScreenToWorldPoint(Input.mousePosition);
        Vector2 dir = (mouseWorld - transform.position);
        float angle = Mathf.Atan2(dir.y, dir.x) * Mathf.Rad2Deg - 90f;
        transform.rotation = Quaternion.Euler(0, 0, angle);

        // إطلاق
        if (Input.GetMouseButton(0) && Time.time >= _nextFire)
        {
            _nextFire = Time.time + fireRate;
            Shoot();
        }
    }

    void FixedUpdate()
    {
        _rb.velocity = _move * moveSpeed;
    }

    void Shoot()
    {
        GameObject b = Instantiate(bulletPrefab, firePoint.position, transform.rotation);
        Rigidbody2D rb = b.GetComponent<Rigidbody2D>();
        rb.velocity = transform.up * bulletSpeed;
    }
}
